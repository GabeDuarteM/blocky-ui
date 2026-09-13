import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { expect, it } from "vitest";

import { SQLiteLogProvider } from "~/server/logs/sqlite/provider";
import { logEntries } from "~/server/logs/sqlite/schema";
import { makeEntry, setupSqlite } from "./setup";

it("fails without creating a missing database", () => {
  const directory = mkdtempSync(join(tmpdir(), "sqlite-missing-"));
  const filePath = join(directory, "missing.db");

  try {
    expect(() => new SQLiteLogProvider({ filePath })).toThrow();
    expect(existsSync(filePath)).toBe(false);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

it("sees new WAL commits through the same reader connection", async () => {
  const { provider, filePath } = setupSqlite([makeEntry()]);
  const writer = new Database(filePath);

  try {
    writer.pragma("journal_mode = WAL");
    const before = await provider.getQueryLogs({ limit: 10, offset: 0 });
    expect(before.items).toHaveLength(1);

    drizzle(writer)
      .insert(logEntries)
      .values(makeEntry({ questionName: "new-commit.example" }))
      .run();

    const after = await provider.getQueryLogs({ limit: 10, offset: 0 });
    expect(after.items).toHaveLength(2);
    expect(after.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ questionName: "new-commit.example" }),
      ]),
    );
  } finally {
    await provider.close();
    writer.close();
    rmSync(dirname(filePath), { recursive: true, force: true });
  }
});
