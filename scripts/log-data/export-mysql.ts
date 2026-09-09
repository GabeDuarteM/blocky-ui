import { mysqlPages } from "./mysql-pages";
import { requireTransactionalTable } from "./mysql-storage";
import { createConnection } from "mysql2/promise";
import { drizzle } from "drizzle-orm/mysql2";
import { asc, gt } from "drizzle-orm";
import { logEntries } from "~/server/logs/mysql/schema";
import { recordSchema, timestamp } from "./record";
import { writeSnapshot } from "./snapshot";

export async function exportMysql(options: {
  url: string;
  output: string;
  offset?: string;
  limit?: number;
}) {
  const offset = options.offset ?? "+00:00";
  const connection = await createConnection({
    uri: options.url,
    timezone: offset,
    dateStrings: true,
    supportBigNumbers: true,
    bigNumberStrings: true,
  });
  const db = drizzle(connection);

  try {
    await requireTransactionalTable(connection);
    await connection.query("SET TRANSACTION ISOLATION LEVEL REPEATABLE READ");
    await connection.query(
      "START TRANSACTION WITH CONSISTENT SNAPSHOT, READ ONLY",
    );

    async function* records() {
      const rows = mysqlPages(
        (afterId, limit) =>
          db
            .select()
            .from(logEntries)
            .where(gt(logEntries.id, afterId))
            .orderBy(asc(logEntries.id))
            .limit(limit),
        options.limit,
      );

      for await (const row of rows) {
        yield recordSchema.parse({
          ...row,
          requestTs: timestamp(row.requestTs, offset),
          durationMs: row.durationMs === null ? null : Number(row.durationMs),
        });
      }
    }

    return await writeSnapshot(options.output, records(), offset);
  } finally {
    await connection.query("ROLLBACK").catch(() => undefined);
    await connection.end();
  }
}
