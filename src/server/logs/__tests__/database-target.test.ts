import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { type Pool } from "mysql2/promise";
import { type Sql } from "postgres";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { type DatabaseTarget } from "~/server/config/schema";
import { MySQLLogProvider } from "~/server/logs/mysql/provider";
import { PostgreSQLLogProvider } from "~/server/logs/postgres/provider";
import {
  makeEntry,
  setupMysql,
  setupPostgres,
} from "~/server/logs/__tests__/setup";

beforeEach(() => vi.resetModules());
afterEach(() => vi.unstubAllEnvs());

it.each([
  {
    type: "mysql",
    setup: setupMysql,
    options: { charset: "latin1", connectTimeout: 15000 },
    connect(target: DatabaseTarget) {
      const connections = new Map<string, Pool>();
      const provider = new MySQLLogProvider({ target, connections });
      const connection = connections.values().next().value;
      return {
        provider,
        async verifyOptions() {
          const result = await connection?.query(
            "SELECT @@character_set_connection AS charset",
          );
          expect(result?.[0]).toEqual([{ charset: "latin1" }]);
        },
        close: () => connection?.end(),
      };
    },
  },
  {
    type: "postgresql",
    setup: setupPostgres,
    options: {
      connection: {
        application_name: "shared secret",
        timezone: "UTC",
        user: "wrong-user",
        database: "wrong-database",
      },
      connect_timeout: 15,
      prepare: false,
    },
    connect(target: DatabaseTarget) {
      const connections = new Map<string, Sql>();
      const provider = new PostgreSQLLogProvider({ target, connections });
      const connection = connections.values().next().value;
      return {
        provider,
        async verifyOptions() {
          expect(connection?.parameters.application_name).toBe("shared secret");
          expect(connection?.options.connect_timeout).toBe(15);
          expect(connection?.options.prepare).toBe(false);
        },
        close: () => connection?.end(),
      };
    },
  },
])(
  "$type reads a password file and applies native options without overriding explicit connection fields",
  async ({ type, setup, options, connect }) => {
    const directory = await mkdtemp(join(tmpdir(), "database-target-"));
    const password = "p@ss:/?#%word";
    const fixture = await setup([makeEntry()], password);

    try {
      const passwordPath = join(directory, "password");
      const configPath = join(directory, "config.yml");
      await writeFile(passwordPath, `${password}\n`);
      await writeFile(
        configPath,
        JSON.stringify({
          servers: {
            test: { url: "http://blocky:4000", logs: { source: "test" } },
          },
          logSources: {
            test: {
              type,
              target: {
                host: fixture.container.getHost(),
                port: fixture.container.getPort(),
                username: fixture.container.getUsername(),
                password: `file:${passwordPath}`,
                database: fixture.container.getDatabase(),
                options: {
                  ...options,
                  host: "invalid.example",
                  port: 1,
                  user: "wrong-user",
                  password: "wrong-password",
                  database: "wrong-database",
                  ...(type === "mysql"
                    ? {
                        password1: "wrong-password",
                        uri: "mysql://wrong:wrong@invalid.example/wrong",
                      }
                    : {
                        hostname: "invalid.example",
                        pass: "wrong-password",
                        db: "wrong-database",
                      }),
                },
              },
            },
          },
        }),
      );
      vi.stubEnv("BLOCKY_UI_CONFIG", configPath);
      const { getConfiguration } = await import("~/server/config");
      const target = (await getConfiguration()).logSources.test?.target;
      if (!target || typeof target === "string") {
        throw new Error("Expected a structured database target");
      }
      const connection = connect(target);
      try {
        expect(await connection.provider.getQueryLogCount({})).toBe(1);
        await connection.verifyOptions();
      } finally {
        await connection.provider.close();
        await connection.close();
      }
    } finally {
      await fixture.provider.close();
      await fixture.container.stop();
      await rm(directory, { recursive: true, force: true });
    }
  },
  60_000,
);
