import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import Database from "better-sqlite3";
import { type Pool } from "mysql2/promise";
import { type Sql } from "postgres";
import { MySQLLogProvider } from "~/server/logs/mysql/provider";
import { PostgreSQLLogProvider } from "~/server/logs/postgres/provider";
import { afterEach, expect, it, vi } from "vitest";
import { aggregateQueriesOverTime } from "~/server/logs/aggregation-utils";
import { CsvLogProvider } from "~/server/logs/csv/provider";
import { CsvClientLogProvider } from "~/server/logs/csv/client-provider";
import { SQLiteLogProvider } from "~/server/logs/sqlite/provider";
import {
  entryToCsvLine,
  makeEntry,
  setupMysql,
  setupPostgres,
} from "~/server/logs/__tests__/setup";

afterEach(() => vi.restoreAllMocks());

it("excludes future events even within the current chart bucket", () => {
  vi.spyOn(Date, "now").mockReturnValue(Date.parse("2026-09-10T10:02:00Z"));

  const result = aggregateQueriesOverTime(
    ["10:01", "10:02", "10:04"].map((time) =>
      makeEntry({ requestTs: `2026-09-10T${time}:00Z` }),
    ),
    "1h",
  );

  expect(result.at(-1)?.total).toBe(2);
});

it.each([CsvLogProvider, CsvClientLogProvider])(
  "%s orders offset timestamps by instant and returns invalid timestamps as null",
  async (Provider) => {
    const directory = await mkdtemp(join(tmpdir(), "csv-timestamps-"));

    try {
      const entries = [
        "2026-09-10T12:00:00+02:00",
        "invalid",
        "2026-09-10T11:00:00Z",
      ];
      await writeFile(
        join(directory, "2026-09-10_client.log"),
        entries
          .map((requestTs) => entryToCsvLine(makeEntry({ requestTs })))
          .join("\n"),
      );

      const result = await new Provider({ directory }).getQueryLogs({
        limit: 10,
        offset: 0,
      });

      expect(result.items.map((entry) => entry.requestTs)).toEqual([
        "2026-09-10T11:00:00.000Z",
        "2026-09-10T10:00:00.000Z",
        null,
      ]);
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  },
);

it("leaves shared SQLite connections open for their cache owner", async () => {
  const directory = await mkdtemp(join(tmpdir(), "sqlite-ownership-"));
  const filePath = join(directory, "blocky.db");
  const seed = new Database(filePath);
  seed.close();
  const connections = new Map<string, Database.Database>();

  try {
    const first = new SQLiteLogProvider({ filePath, connections });
    const second = new SQLiteLogProvider({ filePath, connections });
    await first.close();
    await second.close();

    expect(
      connections.get(filePath)?.prepare("SELECT 1 AS value").get(),
    ).toEqual({ value: 1 });
    const third = new SQLiteLogProvider({ filePath, connections });
    await third.close();
    expect(connections.size).toBe(1);
  } finally {
    for (const connection of connections.values()) {
      connection.close();
    }
    await rm(directory, { recursive: true, force: true });
  }
});

it.each([
  {
    name: "MySQL",
    setup: setupMysql,
    cache(connectionUri: string) {
      const connections = new Map<string, Pool>();
      return {
        provider: () => new MySQLLogProvider({ connectionUri, connections }),
        async close() {
          for (const connection of connections.values()) {
            await connection.end();
          }
        },
      };
    },
  },
  {
    name: "PostgreSQL",
    setup: setupPostgres,
    cache(connectionUri: string) {
      const connections = new Map<string, Sql>();
      return {
        provider: () =>
          new PostgreSQLLogProvider({ connectionUri, connections }),
        async close() {
          for (const connection of connections.values()) {
            await connection.end();
          }
        },
      };
    },
  },
])(
  "leaves shared $name connections open for their cache owner",
  async ({ setup, cache }) => {
    const fixture = await setup([makeEntry()]);
    const shared = cache(fixture.container.getConnectionUri());

    try {
      const first = shared.provider();
      const second = shared.provider();
      await first.close();

      expect(await second.getQueryLogCount({})).toBe(1);
      await second.close();

      const third = shared.provider();
      expect(await third.getQueryLogCount({})).toBe(1);
      await third.close();
    } finally {
      await shared.close();
      await fixture.provider.close();
      await fixture.container.stop();
    }
  },
  60_000,
);
