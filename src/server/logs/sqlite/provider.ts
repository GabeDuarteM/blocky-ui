import { sql, type Column, type SQL } from "drizzle-orm";
import { drizzle } from "drizzle-orm/sqlite-proxy";
import { DatabaseSync, type SQLInputValue } from "node:sqlite";

import { cachedConnection } from "~/server/logs/connection-cache";
import { type TimeRange } from "~/lib/constants";
import { BaseSqlLogProvider } from "~/server/logs/sql/base-provider";
import { logEntries } from "~/server/logs/sqlite/schema";

export class SQLiteLogProvider extends BaseSqlLogProvider {
  private readonly dbFile: DatabaseSync;
  private readonly ownsConnection: boolean;

  constructor(options: {
    filePath: string;
    connections?: Map<string, DatabaseSync>;
  }) {
    const dbFile = cachedConnection(
      options.filePath,
      options.connections,
      () =>
        new DatabaseSync(options.filePath, {
          readOnly: true,
          timeout: 5000,
        }),
    );

    const db = drizzle(
      async (query, params: SQLInputValue[], method) => {
        if (method !== "all" && method !== "values") {
          throw new Error("SQLite log queries must return rows");
        }
        const statement = dbFile.prepare(query);
        statement.setReturnArrays(true);
        return { rows: statement.all(...params) };
      },
      { schema: { logEntries } },
    );

    super({
      db,
      table: logEntries,
      columns: logEntries,
    });

    this.dbFile = dbFile;
    this.ownsConnection = !options.connections;
  }

  async close(): Promise<void> {
    if (this.ownsConnection) {
      this.dbFile.close();
    }
  }

  protected getTextSortExpression(column: Column): SQL {
    return sql`lower(${column})`;
  }

  protected getBucketExpression(range: TimeRange): SQL {
    const col = logEntries.requestTs.name;

    switch (range) {
      case "1h":
        return sql.raw(
          `strftime('%Y-%m-%d %H:', ${col}) || printf('%02d', (cast(strftime('%M', ${col}) as integer) / 5) * 5)`,
        );
      case "24h":
        return sql.raw(`strftime('%Y-%m-%d %H:00', ${col})`);
      case "7d":
        return sql.raw(
          `strftime('%Y-%m-%d ', ${col}) || printf('%02d', (cast(strftime('%H', ${col}) as integer) / 6) * 6) || ':00'`,
        );
      case "30d":
        return sql.raw(`strftime('%Y-%m-%d', ${col})`);
    }
  }
}
