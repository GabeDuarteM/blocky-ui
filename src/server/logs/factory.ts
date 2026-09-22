import type { DatabaseSync } from "node:sqlite";
import type { createPool } from "mysql2/promise";
import type { default as postgres } from "postgres";

import type { Configuration } from "~/server/config/schema";
import { CsvClientLogProvider } from "~/server/logs/csv/client-provider";
import { CsvLogProvider } from "~/server/logs/csv/provider";
import { MySQLLogProvider } from "~/server/logs/mysql/provider";
import { PostgreSQLLogProvider } from "~/server/logs/postgres/provider";
import type { LogProvider } from "~/server/logs/types";
import { VictoriaLogsProvider } from "~/server/logs/victorialogs/provider";

declare global {
  var blockyLogConnections:
    | {
        mysql: Map<string, ReturnType<typeof createPool>>;
        postgres: Map<string, ReturnType<typeof postgres>>;
        sqlite: Map<string, DatabaseSync>;
      }
    | undefined;
}

export async function initializeLogSource(
  source: Configuration["logSources"][string],
): Promise<LogProvider> {
  globalThis.blockyLogConnections ??= {
    mysql: new Map(),
    postgres: new Map(),
    sqlite: new Map(),
  };
  const connections = globalThis.blockyLogConnections;

  switch (source.type) {
    case "mysql":
      return new MySQLLogProvider({
        target: source.target,
        connections: connections.mysql,
      });
    case "postgresql":
    case "timescale":
      return new PostgreSQLLogProvider({
        target: source.target,
        connections: connections.postgres,
      });
    case "csv":
      return new CsvLogProvider({ directory: source.target });
    case "csv-client":
      return new CsvClientLogProvider({ directory: source.target });
    case "console":
      return new VictoriaLogsProvider({ url: source.target });
    case "sqlite": {
      const { SQLiteLogProvider } = await import(
        "~/server/logs/sqlite/provider"
      );

      return new SQLiteLogProvider({
        filePath: source.target,
        connections: connections.sqlite,
      });
    }

    default:
      throw new Error(`Unexpected value: ${source satisfies never}`);
  }
}
