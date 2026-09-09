import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import Database from "better-sqlite3";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { type Configuration } from "~/server/config/schema";
import { type LogProvider } from "~/server/logs/types";

const providers: LogProvider[] = [];
let directory: string;

beforeEach(async () => {
  vi.resetModules();
  vi.stubGlobal("blockyLogConnections", undefined);
  directory = await mkdtemp(join(tmpdir(), "blocky-hmr-"));
});

afterEach(async () => {
  await Promise.all(providers.splice(0).map((provider) => provider.close?.()));
  vi.unstubAllGlobals();
  await rm(directory, { recursive: true, force: true });
});

describe("database connections across module reloads", () => {
  it.each(["mysql", "postgresql", "sqlite"] as const)(
    "reloads %s provider code while retaining its connection",
    async (type) => {
      const sqlite = join(directory, "logs.sqlite");

      if (type === "sqlite") {
        new Database(sqlite).close();
      }

      const source: Configuration["logSources"][string] =
        type === "sqlite"
          ? { type, target: sqlite }
          : { type, target: `${type}://test:test@127.0.0.1:1/blocky` };

      const firstModule = await import("~/server/logs/factory");
      const first = await firstModule.initializeLogSource(source);
      providers.push(first);

      const cacheKey = type === "postgresql" ? "postgres" : type;
      const connection = globalThis.blockyLogConnections?.[cacheKey].get(
        source.target,
      );

      vi.resetModules();

      const reloadedModule = await import("~/server/logs/factory");
      const reloaded = await reloadedModule.initializeLogSource(source);

      expect(connection).toBeDefined();
      expect(globalThis.blockyLogConnections?.[cacheKey].size).toBe(1);
      expect(
        globalThis.blockyLogConnections?.[cacheKey].get(source.target),
      ).toBe(connection);
      expect(reloaded.constructor).not.toBe(first.constructor);
    },
  );
});
