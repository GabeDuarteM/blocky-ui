import { env } from "~/env";
import {
  findLatestLogFile,
  readLogFile,
  LogFileWatcher,
  type LogEntry,
} from "./csv-log-reader";
import { desc, sql, and, eq } from "drizzle-orm";
import type { MySql2Database } from "drizzle-orm/mysql2";
import { logEntries } from "./db/schema";
import type * as schema from "./db/schema";

type DbType = MySql2Database<typeof schema>;

export interface LogProvider {
  getQueryLogs(options: {
    limit: number;
    offset: number;
    search?: string;
    responseType?: string;
  }): Promise<{
    items: LogEntry[];
    totalCount: number;
  }>;
  cleanup?(): void;
}

/**
 * MySQL-based log provider
 */
export class MySQLLogProvider implements LogProvider {
  constructor(private db: DbType) {}

  async getQueryLogs(options: {
    limit: number;
    offset: number;
    search?: string;
    responseType?: string;
  }): Promise<{ items: LogEntry[]; totalCount: number }> {
    const filters = [];

    if (options.search) {
      filters.push(
        sql`LOWER(${logEntries.questionName}) LIKE LOWER(${`%${options.search}%`})`,
      );
    }

    if (options.responseType) {
      filters.push(eq(logEntries.responseType, options.responseType));
    }

    const countQuery = this.db
      .select({ count: sql<number>`count(*)` })
      .from(logEntries)
      .where(filters.length > 0 ? and(...filters) : undefined);

    const countResult = await countQuery;
    const count = countResult?.[0]?.count ?? 0;

    const query = this.db
      .select()
      .from(logEntries)
      .orderBy(desc(logEntries.requestTs))
      .limit(options.limit)
      .offset(options.offset)
      .where(filters.length > 0 ? and(...filters) : undefined);

    const logs = await query;

    return {
      items: logs,
      totalCount: Number(count),
    };
  }
}

/**
 * CSV file-based log provider
 */
export class CSVLogProvider implements LogProvider {
  private currentLogFile: string | null = null;
  private watcher: LogFileWatcher | null = null;
  private checkFileIntervalId: NodeJS.Timeout | null = null;

  constructor(private directory: string) {
    this.initializeWatcher();
  }

  private async initializeWatcher(): Promise<void> {
    try {
      this.currentLogFile = await findLatestLogFile(this.directory);

      if (this.currentLogFile) {
        console.log(`Monitoring log file: ${this.currentLogFile}`);

        // Start watching for new entries
        this.watcher = new LogFileWatcher(
          this.currentLogFile,
          (newEntries) => {
            console.log(`Detected ${newEntries.length} new log entries`);
          },
          5000, // Check every 5 seconds
        );

        await this.watcher.start();

        // Check for file rotation every 60 seconds
        this.checkFileIntervalId = setInterval(
          // eslint-disable-next-line @typescript-eslint/no-misused-promises
          () => this.checkForFileRotation(),
          60000,
        );
      }
    } catch (error) {
      console.error("Error initializing CSV log watcher:", error);
    }
  }

  private async checkForFileRotation(): Promise<void> {
    try {
      const latestFile = await findLatestLogFile(this.directory);

      if (latestFile && latestFile !== this.currentLogFile) {
        console.log(
          `Log file rotated. Switching from ${this.currentLogFile} to ${latestFile}`,
        );
        this.currentLogFile = latestFile;

        if (this.watcher) {
          await this.watcher.switchToFile(latestFile);
        }
      }
    } catch (error) {
      console.error("Error checking for file rotation:", error);
    }
  }

  async getQueryLogs(options: {
    limit: number;
    offset: number;
    search?: string;
    responseType?: string;
  }): Promise<{ items: LogEntry[]; totalCount: number }> {
    // Ensure we have the latest file
    if (!this.currentLogFile) {
      this.currentLogFile = await findLatestLogFile(this.directory);
    }

    if (!this.currentLogFile) {
      console.error(`No log files found in directory: ${this.directory}`);
      return { items: [], totalCount: 0 };
    }

    return await readLogFile(this.currentLogFile, options);
  }

  cleanup(): void {
    if (this.watcher) {
      this.watcher.stop();
    }

    if (this.checkFileIntervalId) {
      clearInterval(this.checkFileIntervalId);
    }
  }
}

/**
 * Singleton cache for log provider
 */
const globalForLogProvider = globalThis as unknown as {
  logProvider: LogProvider | undefined;
};

/**
 * Factory function to create the appropriate log provider
 * Uses singleton pattern to avoid creating multiple watchers/connections
 */
export function createLogProvider(dbConnection?: DbType): LogProvider {
  if (globalForLogProvider.logProvider) {
    return globalForLogProvider.logProvider;
  }

  const logType = env.QUERY_LOG_TYPE.toLowerCase();

  let provider: LogProvider;

  if (logType === "csv") {
    const directory = env.QUERY_LOG_TARGET;

    if (!directory) {
      throw new Error(
        "QUERY_LOG_TARGET must be set to a directory path when using CSV log type",
      );
    }

    provider = new CSVLogProvider(directory);
  } else {
    // Default to MySQL
    if (!dbConnection) {
      throw new Error("Database connection required for MySQL log provider");
    }

    provider = new MySQLLogProvider(dbConnection);
  }

  // Cache the provider for reuse
  globalForLogProvider.logProvider = provider;

  // Cleanup on process exit
  if (typeof process !== "undefined") {
    const cleanup = () => {
      if (globalForLogProvider.logProvider?.cleanup) {
        globalForLogProvider.logProvider.cleanup();
      }
    };

    process.on("beforeExit", cleanup);
    process.on("SIGINT", cleanup);
    process.on("SIGTERM", cleanup);
  }

  return provider;
}
