import { DatabaseSync, type SQLInputValue } from "node:sqlite";
import { type Column, type SQL, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/sqlite-proxy";
import type { TimeRange } from "~/lib/constants";
import { cachedConnection } from "~/server/logs/connection-cache";
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
      (query, params: SQLInputValue[], method) => {
        if (method !== "all" && method !== "values") {
          return Promise.reject(
            new Error("SQLite log queries must return rows"),
          );
        }
        const statement = dbFile.prepare(query);
        statement.setReturnArrays(true);
        return Promise.resolve({ rows: statement.all(...params) });
      },
      { schema: { logEntries } },
    );

    super({
      columns: logEntries,
      select: (fields) => db.select(fields).from(logEntries).$dynamic(),
    });

    this.dbFile = dbFile;
    this.ownsConnection = !options.connections;
  }

  close(): Promise<void> {
    if (this.ownsConnection) {
      this.dbFile.close();
    }

    return Promise.resolve();
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

      default:
        throw new Error(`Unexpected value: ${range satisfies never}`);
    }
  }
}
