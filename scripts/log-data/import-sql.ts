import { mysqlPages } from "./mysql-pages";
import { asc, gt } from "drizzle-orm";
import { TransferError } from "./errors";
import { requireTransactionalTable } from "./mysql-storage";
import { createConnection } from "mysql2/promise";
import postgres from "postgres";
import Database from "better-sqlite3";
import { z } from "zod";
import { drizzle as mysqlDrizzle } from "drizzle-orm/mysql2";
import { drizzle as pgDrizzle } from "drizzle-orm/postgres-js";
import { drizzle as sqliteDrizzle } from "drizzle-orm/better-sqlite3";
import { logEntries as mysqlTable } from "~/server/logs/mysql/schema";
import { logEntries as pgTable } from "~/server/logs/postgres/schema";
import { logEntries as sqliteTable } from "~/server/logs/sqlite/schema";
import {
  fingerprint,
  databaseRecord,
  recordSchema,
  timestamp,
  type RecordEntry,
} from "./record";

export type SqlDestination = "mysql" | "postgresql" | "timescale" | "sqlite";

type Store = {
  hasRows: () => Promise<boolean>;
  insert: (records: RecordEntry[]) => Promise<unknown>;
  rows: () => AsyncIterable<unknown> | Iterable<unknown>;
};

async function transfer(store: Store, records: AsyncIterable<RecordEntry>) {
  if (await store.hasRows()) {
    throw new TransferError("The destination log_entries table must be empty.");
  }

  const expected = fingerprint();
  let batch: RecordEntry[] = [];

  for await (const record of records) {
    expected.add(record);
    batch.push(record);

    if (batch.length === 500) {
      await store.insert(batch);
      batch = [];
    }
  }

  if (batch.length > 0) {
    await store.insert(batch);
  }

  const actual = fingerprint();

  for await (const value of store.rows()) {
    const row = z.record(z.string(), z.unknown()).parse(value);
    const parsed = recordSchema.parse({
      ...row,
      requestTs: timestamp(row.requestTs),
      durationMs: row.durationMs === null ? null : Number(row.durationMs),
    });
    actual.add(parsed);
  }

  if (JSON.stringify(actual.result()) !== JSON.stringify(expected.result())) {
    throw new TransferError(
      "Destination verification failed. The import has been rolled back.",
    );
  }

  return actual.result();
}

export async function importSql(
  type: SqlDestination,
  target: string,
  records: AsyncIterable<RecordEntry>,
) {
  if (type === "mysql") {
    const connection = await createConnection({
      uri: target,
      timezone: "Z",
      dateStrings: true,
    });

    try {
      await requireTransactionalTable(connection);
      return await mysqlDrizzle(connection).transaction(async (tx) =>
        transfer(
          {
            hasRows: async () =>
              (
                await tx
                  .select({ id: mysqlTable.id })
                  .from(mysqlTable)
                  .limit(1)
                  .for("update")
              ).length > 0,
            insert: (batch) =>
              tx.insert(mysqlTable).values(
                batch.map((record) => ({
                  ...record,
                  requestTs: record.requestTs
                    .replace("T", " ")
                    .replace("Z", ""),
                })),
              ),
            rows: () =>
              mysqlPages((afterId, limit) =>
                tx
                  .select()
                  .from(mysqlTable)
                  .where(gt(mysqlTable.id, afterId))
                  .orderBy(asc(mysqlTable.id))
                  .limit(limit),
              ),
          },
          records,
        ),
      );
    } finally {
      await connection.end();
    }
  }

  if (type === "sqlite") {
    const connection = new Database(target, { fileMustExist: true });
    const db = sqliteDrizzle(connection);

    try {
      connection.exec("BEGIN IMMEDIATE");
      const result = await transfer(
        {
          hasRows: async () =>
            db.select().from(sqliteTable).limit(1).all().length > 0,
          insert: async (batch) =>
            db
              .insert(sqliteTable)
              .values(
                batch.map((record) => ({
                  ...record,
                  requestTs: record.requestTs
                    .replace("T", " ")
                    .replace("Z", "+00:00"),
                })),
              )
              .run(),
          rows: function* () {
            for (const row of connection
              .prepare(db.select().from(sqliteTable).toSQL().sql)
              .iterate()) {
              yield databaseRecord(row);
            }
          },
        },
        records,
      );
      connection.exec("COMMIT");
      return result;
    } catch (error) {
      if (connection.inTransaction) {
        connection.exec("ROLLBACK");
      }
      throw error;
    } finally {
      connection.close();
    }
  }

  const connection = postgres(target, { max: 1 });

  try {
    return await connection.begin(async (sql) => {
      await sql`LOCK TABLE log_entries IN EXCLUSIVE MODE`;
      const db = pgDrizzle(connection);

      return transfer(
        {
          hasRows: async () =>
            (await sql`SELECT 1 FROM log_entries LIMIT 1`).length > 0,
          insert: async (batch) => {
            const query = db.insert(pgTable).values(batch).toSQL();
            const parameters = z
              .array(z.union([z.string(), z.number(), z.null()]))
              .parse(query.params);
            await sql.unsafe(query.sql, parameters);
          },
          rows: async function* () {
            const query = db.select().from(pgTable).toSQL();

            for await (const rows of sql.unsafe(query.sql).cursor(500)) {
              for (const row of rows) {
                yield databaseRecord(row);
              }
            }
          },
        },
        records,
      );
    });
  } finally {
    await connection.end();
  }
}
