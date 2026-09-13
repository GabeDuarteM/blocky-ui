import { type createPool } from "mysql2/promise";
import { type default as postgres } from "postgres";
import { type DatabaseSync } from "node:sqlite";

import { type Configuration } from "~/server/config/schema";
import { type LogProvider } from "~/server/logs/types";
import { MySQLLogProvider } from "~/server/logs/mysql/provider";
import { PostgreSQLLogProvider } from "~/server/logs/postgres/provider";
import { CsvLogProvider } from "~/server/logs/csv/provider";
import { CsvClientLogProvider } from "~/server/logs/csv/client-provider";
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
  const connections = (globalThis.blockyLogConnections ??= {
    mysql: new Map(),
    postgres: new Map(),
    sqlite: new Map(),
  });

  switch (source.type) {
    case "mysql":
      return new MySQLLogProvider({
        connectionUri: source.target,
        connections: connections.mysql,
      });
    case "postgresql":
    case "timescale":
      return new PostgreSQLLogProvider({
        connectionUri: source.target,
        connections: connections.postgres,
      });
    case "csv":
      return new CsvLogProvider({ directory: source.target });
    case "csv-client":
      return new CsvClientLogProvider({ directory: source.target });
    case "console":
      return new VictoriaLogsProvider({ url: source.target });
    case "sqlite": {
      const { SQLiteLogProvider } =
        await import("~/server/logs/sqlite/provider");

      return new SQLiteLogProvider({
        filePath: source.target,
        connections: connections.sqlite,
      });
    }
  }
}
