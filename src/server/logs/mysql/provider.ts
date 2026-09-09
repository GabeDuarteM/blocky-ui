import { desc, gte, inArray, sql, type SQL } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { createPool } from "mysql2/promise";

import { cachedConnection } from "~/server/logs/connection-cache";
import { logEntries } from "~/server/logs/mysql/schema";
import { type TimeRange } from "~/lib/constants";
import { BaseSqlLogProvider } from "~/server/logs/sql/base-provider";
import { type QueryLogsOptions } from "~/server/logs/types";

const RECENT_SEARCH_ROWS = 65_536;

export class MySQLLogProvider extends BaseSqlLogProvider {
  private readonly pool: ReturnType<typeof createPool>;
  private readonly mysqlDb;

  constructor(options: {
    connectionUri: string;
    connections?: Map<string, ReturnType<typeof createPool>>;
  }) {
    const pool = cachedConnection(
      options.connectionUri,
      options.connections,
      () =>
        createPool({
          uri: options.connectionUri,
          timezone: "+00:00",
        }),
    );
    const db = drizzle(pool, { schema: { logEntries }, mode: "default" });

    super({
      db,
      table: logEntries,
      columns: logEntries,
    });

    this.pool = pool;
    this.mysqlDb = db;
  }

  async getQueryLogRows(options: QueryLogsOptions) {
    if (
      !options.search ||
      options.client ||
      options.responseType ||
      options.questionType
    ) {
      return super.getQueryLogRows(options);
    }

    if (options.offset + options.limit <= RECENT_SEARCH_ROWS) {
      const [boundary] = await this.mysqlDb
        .select({ timestamp: logEntries.requestTs })
        .from(logEntries)
        .orderBy(desc(logEntries.requestTs), desc(logEntries.id))
        .offset(RECENT_SEARCH_ROWS - 1)
        .limit(1);

      if (!boundary) {
        return super.getQueryLogRows(options);
      }

      if (boundary.timestamp) {
        const recent = await this.readQueryLogRows(options, [
          gte(logEntries.requestTs, boundary.timestamp),
        ]);

        if (recent.length === options.limit) {
          return recent;
        }
      }
    }

    // Sparse matches make an ordered secondary-index scan read almost every full row.
    return this.readQueryLogRows(options, [], { useIndex: ["PRIMARY"] });
  }

  protected async clientFilter(client: string): Promise<SQL> {
    const clients = this.mysqlDb
      .selectDistinct({ name: logEntries.clientName })
      .from(logEntries)
      .as("clients");
    const matches = await this.mysqlDb
      .select({ name: clients.name })
      .from(clients)
      .where(sql`LOWER(${clients.name}) LIKE LOWER(${`%${client}%`})`)
      .limit(1001);

    if (matches.length > 1000) {
      return super.clientFilter(client);
    }

    const names = matches.flatMap(({ name }) => (name === null ? [] : [name]));

    return names.length ? inArray(logEntries.clientName, names) : sql`false`;
  }

  protected getClientRankingIndexHints(
    range: TimeRange,
    filter: "all" | "blocked",
  ) {
    // Long-range client grouping otherwise favors repeated row lookups through the client-name index.
    return filter === "all" && (range === "7d" || range === "30d")
      ? { useIndex: ["PRIMARY"] }
      : undefined;
  }

  async close(): Promise<void> {
    await this.pool.end();
  }

  protected getBucketExpression(range: TimeRange): SQL {
    const col = logEntries.requestTs.name;

    switch (range) {
      case "1h":
        // Round to 5-minute intervals
        return sql.raw(
          `CONCAT(DATE_FORMAT(${col}, '%Y-%m-%d %H:'), LPAD(FLOOR(MINUTE(${col})/5)*5, 2, '0'))`,
        );
      case "24h":
        // Round to hourly intervals
        return sql.raw(`DATE_FORMAT(${col}, '%Y-%m-%d %H:00')`);
      case "7d":
        // Round to 6-hour intervals (0, 6, 12, 18)
        return sql.raw(
          `CONCAT(DATE_FORMAT(${col}, '%Y-%m-%d '), LPAD(FLOOR(HOUR(${col})/6)*6, 2, '0'), ':00')`,
        );
      case "30d":
        // Round to daily intervals
        return sql.raw(`DATE_FORMAT(${col}, '%Y-%m-%d')`);
    }
  }
}
