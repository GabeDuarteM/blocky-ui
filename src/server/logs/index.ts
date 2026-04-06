import { env } from "~/env";
import { MySQLLogProvider } from "~/server/logs/mysql/provider";
import { PostgreSQLLogProvider } from "~/server/logs/postgres/provider";
import { DemoLogProvider } from "~/server/logs/demo-provider";
import { CsvLogProvider } from "~/server/logs/csv/provider";
import { CsvClientLogProvider } from "~/server/logs/csv/client-provider";
import { VictoriaLogsProvider } from "~/server/logs/victorialogs/provider";
import type { LogProvider } from "~/server/logs/types";

/**
 * Cache the log provider in development.
 * This avoids creating a new provider (and db connections, when applicable) on every HMR update.
 */
const globalForLogProvider = globalThis as unknown as {
  logProvider: LogProvider | undefined;
};

/**
 * Factory function to create the appropriate log provider
 * Uses singleton pattern to avoid creating multiple watchers/connections
 */
export function createLogProvider(): LogProvider | undefined {
  if (globalForLogProvider.logProvider) {
    return globalForLogProvider.logProvider;
  }

  if (env.DATABASE_URL) {
    console.warn(
      "⚠️  DEPRECATION WARNING: DATABASE_URL is deprecated. Please use QUERY_LOG_TYPE and QUERY_LOG_TARGET instead.",
    );
  }

  let provider: LogProvider | undefined;

  if (env.DEMO_MODE) {
    console.log("Using log provider type: demo");
    provider = new DemoLogProvider();
  } else {
    const logType = env.QUERY_LOG_TYPE?.toLowerCase();
    const logTarget = env.QUERY_LOG_TARGET;

    if (logType === "csv") {
      console.log("Using log provider type: csv, target:", logTarget);
      if (!logTarget) {
        throw new Error(
          "QUERY_LOG_TARGET must be set to a directory path when QUERY_LOG_TYPE == 'csv'",
        );
      }

      provider = new CsvLogProvider({ directory: logTarget });
    } else if (logType === "csv-client") {
      console.log("Using log provider type: csv-client, target:", logTarget);
      if (!logTarget) {
        throw new Error(
          "QUERY_LOG_TARGET must be set to a directory path when QUERY_LOG_TYPE == 'csv-client'",
        );
      }

      provider = new CsvClientLogProvider({ directory: logTarget });
    } else if (logType === "mysql") {
      console.log("Using log provider type: mysql");
      if (!logTarget) {
        throw new Error(
          "QUERY_LOG_TARGET (MySQL connection URI) is required when using QUERY_LOG_TYPE == 'mysql'",
        );
      }

      provider = new MySQLLogProvider({
        connectionUri: logTarget,
      });
    } else if (logType === "postgresql" || logType === "timescale") {
      console.log(`Using log provider type: ${logType}`);
      if (!logTarget) {
        throw new Error(
          `QUERY_LOG_TARGET (PostgreSQL connection URI) is required when using QUERY_LOG_TYPE == '${logType}'`,
        );
      }

      provider = new PostgreSQLLogProvider({
        connectionUri: logTarget,
      });
    } else if (logType === "console") {
      const consoleProvider = env.QUERY_LOG_CONSOLE_PROVIDER;
      if (!consoleProvider) {
        throw new Error(
          "QUERY_LOG_CONSOLE_PROVIDER must be set when QUERY_LOG_TYPE == 'console' (supported values: 'victorialogs')",
        );
      }
      if (!logTarget) {
        throw new Error(
          "QUERY_LOG_TARGET (provider base URL) is required when QUERY_LOG_TYPE == 'console'",
        );
      }
      console.log(
        `Using log provider type: console (${consoleProvider}), target: ${logTarget}`,
      );
      provider = new VictoriaLogsProvider({ url: logTarget });
    }
  }

  globalForLogProvider.logProvider = provider;
  return provider;
}
