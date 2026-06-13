import { env } from "~/env";
import { MySQLLogProvider } from "~/server/logs/mysql/provider";
import { PostgreSQLLogProvider } from "~/server/logs/postgres/provider";
import { DemoLogProvider } from "~/server/logs/demo-provider";
import { CsvLogProvider } from "~/server/logs/csv/provider";
import { CsvClientLogProvider } from "~/server/logs/csv/client-provider";
import { VictoriaLogsProvider } from "~/server/logs/victorialogs/provider";
import type { LogProvider } from "~/server/logs/types";

const globalForLogProvider = globalThis as unknown as {
  logProvider: Promise<LogProvider | undefined> | undefined;
};

type SQLiteProviderModule = {
  SQLiteLogProvider: new (options: { filePath: string }) => LogProvider;
};

/**
 * Cache provider initialization across HMR and concurrent requests.
 * This avoids duplicate file watchers and database connection pools.
 */
export async function createLogProvider(): Promise<LogProvider | undefined> {
  globalForLogProvider.logProvider ??= initializeLogProvider().catch(
    (error) => {
      globalForLogProvider.logProvider = undefined;
      throw error;
    },
  );

  return globalForLogProvider.logProvider;
}

async function initializeLogProvider(): Promise<LogProvider | undefined> {
  if (env.DATABASE_URL) {
    console.warn(
      "⚠️  DEPRECATION WARNING: DATABASE_URL is deprecated. Please use QUERY_LOG_TYPE and QUERY_LOG_TARGET instead.",
    );
  }

  if (env.DEMO_MODE) {
    console.log("Using log provider type: demo");
    return new DemoLogProvider();
  }

  const logType = env.QUERY_LOG_TYPE?.toLowerCase();
  const logTarget = env.QUERY_LOG_TARGET;

  switch (logType) {
    case "csv":
      console.log("Using log provider type: csv, target:", logTarget);
      return new CsvLogProvider({
        directory: requireLogTarget(
          logTarget,
          "QUERY_LOG_TARGET must be set to a directory path when QUERY_LOG_TYPE == 'csv'",
        ),
      });

    case "csv-client":
      console.log("Using log provider type: csv-client, target:", logTarget);
      return new CsvClientLogProvider({
        directory: requireLogTarget(
          logTarget,
          "QUERY_LOG_TARGET must be set to a directory path when QUERY_LOG_TYPE == 'csv-client'",
        ),
      });

    case "mysql":
      console.log("Using log provider type: mysql");
      return new MySQLLogProvider({
        connectionUri: requireLogTarget(
          logTarget,
          "QUERY_LOG_TARGET (MySQL connection URI) is required when using QUERY_LOG_TYPE == 'mysql'",
        ),
      });

    case "postgresql":
    case "timescale":
      console.log(`Using log provider type: ${logType}`);
      return new PostgreSQLLogProvider({
        connectionUri: requireLogTarget(
          logTarget,
          `QUERY_LOG_TARGET (PostgreSQL connection URI) is required when using QUERY_LOG_TYPE == '${logType}'`,
        ),
      });

    case "sqlite":
      console.log("Using log provider type: sqlite, target:", logTarget);
      return createSQLiteLogProvider({
        filePath: requireLogTarget(
          logTarget,
          "QUERY_LOG_TARGET (SQLite database file path) is required when using QUERY_LOG_TYPE == 'sqlite'",
        ),
      });

    case "console": {
      const consoleProvider = env.QUERY_LOG_CONSOLE_PROVIDER;
      if (!consoleProvider) {
        throw new Error(
          "QUERY_LOG_CONSOLE_PROVIDER must be set when QUERY_LOG_TYPE == 'console' (supported values: 'victorialogs')",
        );
      }

      console.log(
        `Using log provider type: console (${consoleProvider}), target: ${logTarget}`,
      );
      return new VictoriaLogsProvider({
        url: requireLogTarget(
          logTarget,
          "QUERY_LOG_TARGET (provider base URL) is required when using QUERY_LOG_TYPE == 'console'",
        ),
      });
    }

    case undefined:
      return undefined;
  }

  return undefined;
}

async function createSQLiteLogProvider(options: {
  filePath: string;
}): Promise<LogProvider> {
  let sqliteProviderModule: SQLiteProviderModule;

  try {
    sqliteProviderModule = await import("~/server/logs/sqlite/provider");
  } catch (error) {
    throw new Error("Failed to load the SQLite log provider.", {
      cause: error,
    });
  }

  return new sqliteProviderModule.SQLiteLogProvider(options);
}

function requireLogTarget(value: string | undefined, message: string): string {
  if (!value) {
    throw new Error(message);
  }

  return value;
}
