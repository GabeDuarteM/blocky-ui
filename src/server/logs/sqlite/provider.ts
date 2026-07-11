import { sql, type Column, type SQL } from "drizzle-orm";
import { drizzle } from "drizzle-orm/better-sqlite3";
import Database from "better-sqlite3";

import { type TimeRange } from "~/lib/constants";
import { BaseSqlLogProvider } from "~/server/logs/sql/base-provider";
import { logEntries } from "~/server/logs/sqlite/schema";

export class SQLiteLogProvider extends BaseSqlLogProvider {
  private readonly dbFile: Database.Database;

  constructor(options: { filePath: string }) {
    const dbFile = new Database(options.filePath, {
      readonly: true,
      fileMustExist: true,
    });
    dbFile.pragma("busy_timeout = 5000");

    const db = drizzle(dbFile, { schema: { logEntries } });

    super({
      db,
      table: logEntries,
      columns: logEntries,
    });

    this.dbFile = dbFile;
  }

  async close(): Promise<void> {
    this.dbFile.close();
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
