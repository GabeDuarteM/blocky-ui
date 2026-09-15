import { sql, type SQL } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import { type DatabaseTarget } from "~/server/config/schema";
import { cachedConnection } from "~/server/logs/connection-cache";
import { logEntries } from "~/server/logs/postgres/schema";
import { type TimeRange } from "~/lib/constants";
import { BaseSqlLogProvider } from "~/server/logs/sql/base-provider";

export class PostgreSQLLogProvider extends BaseSqlLogProvider {
  private readonly conn: ReturnType<typeof postgres>;
  private readonly ownsConnection: boolean;

  constructor(options: {
    target: string | DatabaseTarget;
    connections?: Map<string, ReturnType<typeof postgres>>;
  }) {
    const conn = cachedConnection(options.target, options.connections, () => {
      const settings = { connection: { timezone: "UTC" } };
      if (typeof options.target === "string") {
        return postgres(options.target, settings);
      }
      const {
        username,
        options: driverOptions,
        ...connection
      } = options.target;
      const startup = driverOptions?.connection;
      return postgres({
        ...driverOptions,
        ...connection,
        hostname: connection.host,
        user: username,
        pass: () => connection.password,
        connection: {
          ...settings.connection,
          ...(startup && typeof startup === "object" && !Array.isArray(startup)
            ? startup
            : {}),
          user: username,
          database: connection.database,
        },
      });
    });
    const db = drizzle(conn, { schema: { logEntries } });

    super({
      db,
      table: logEntries,
      columns: logEntries,
    });

    this.conn = conn;
    this.ownsConnection = !options.connections;
  }

  async close(): Promise<void> {
    if (this.ownsConnection) {
      await this.conn.end();
    }
  }

  protected formatDateTimeForFilter(date: Date): string {
    return date.toISOString();
  }

  protected getBucketExpression(range: TimeRange): SQL {
    const col = logEntries.requestTs.name;

    switch (range) {
      case "1h":
        // Round to 5-minute intervals
        return sql.raw(
          `TO_CHAR(DATE_TRUNC('hour', ${col}) + INTERVAL '5 min' * FLOOR(EXTRACT(MINUTE FROM ${col}) / 5), 'YYYY-MM-DD HH24:MI')`,
        );
      case "24h":
        // Round to hourly intervals
        return sql.raw(
          `TO_CHAR(DATE_TRUNC('hour', ${col}), 'YYYY-MM-DD HH24:00')`,
        );
      case "7d":
        // Round to 6-hour intervals (0, 6, 12, 18)
        return sql.raw(
          `TO_CHAR(DATE_TRUNC('day', ${col}) + INTERVAL '6 hours' * FLOOR(EXTRACT(HOUR FROM ${col}) / 6), 'YYYY-MM-DD HH24:00')`,
        );
      case "30d":
        // Round to daily intervals
        return sql.raw(`TO_CHAR(DATE_TRUNC('day', ${col}), 'YYYY-MM-DD')`);
    }
  }
}
