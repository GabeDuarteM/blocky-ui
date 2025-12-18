import { env } from "~/env";
import {
  findLatestLogFile,
  readLogFile,
  LogFileWatcher,
  type LogEntry,
} from "./csv-log-reader";
import { desc, sql, and, eq } from "drizzle-orm";
import type { MySql2Database } from "drizzle-orm/mysql2";

import { db } from "./db";
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
 * CSV file-based log provider with in-memory caching
 */
export class CSVLogProvider implements LogProvider {
  private currentLogFile: string | null = null;
  private watcher: LogFileWatcher | null = null;
  private checkFileIntervalId: NodeJS.Timeout | null = null;

  // In-memory cache for log entries
  private cachedEntries: LogEntry[] = [];
  private cacheMaxSize: number = 1000; // Keep last 1k entries in memory
  private lastFullRead: number = 0;
  private cacheInvalidationMs: number = 300000; // Re-read full file every 5 minutes

  constructor(private directory: string) {
    this.initializeWatcher();
  }

  private async initializeWatcher(): Promise<void> {
    try {
      this.currentLogFile = await findLatestLogFile(this.directory);

      if (this.currentLogFile) {
        console.log(`Monitoring log file: ${this.currentLogFile}`);

        // Load initial cache
        await this.loadInitialCache();

        // Start watching for new entries
        this.watcher = new LogFileWatcher(
          this.currentLogFile,
          (newEntries) => {
            console.log(`Detected ${newEntries.length} new log entries`);
            this.addToCache(newEntries);
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

  /**
   * Load initial cache from the log file
   */
  private async loadInitialCache(): Promise<void> {
    if (!this.currentLogFile) return;

    try {
      // Read the last N entries to populate cache
      const result = await readLogFile(this.currentLogFile, {
        limit: this.cacheMaxSize,
        offset: 0,
      });

      this.cachedEntries = result.items;
      this.lastFullRead = Date.now();
      console.log(`Loaded ${this.cachedEntries.length} entries into cache`);
    } catch (error) {
      console.error("Error loading initial cache:", error);
    }
  }

  /**
   * Add new entries to the cache (from file watcher)
   */
  private addToCache(newEntries: LogEntry[]): void {
    // Add new entries to the beginning (most recent first)
    this.cachedEntries = [...newEntries.reverse(), ...this.cachedEntries];

    // Trim cache if it exceeds max size
    if (this.cachedEntries.length > this.cacheMaxSize) {
      this.cachedEntries = this.cachedEntries.slice(0, this.cacheMaxSize);
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

        // Reload cache from new file
        await this.loadInitialCache();
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

    const logFile = this.currentLogFile;

    if (!logFile) {
      console.error(`No log files found in directory: ${this.directory}`);
      return { items: [], totalCount: 0 };
    }

    // Check if cache is stale and needs refresh
    const cacheAge = Date.now() - this.lastFullRead;
    if (cacheAge > this.cacheInvalidationMs) {
      console.log(`Cache is stale (${cacheAge}ms old), reloading...`);
      await this.loadInitialCache();
    }

    // If we have filters or the offset is beyond our cache, fall back to file reading
    const hasFilters = options.search || options.responseType;

    if (
      !hasFilters &&
      this.cachedEntries.length > 0 &&
      options.offset < this.cachedEntries.length
    ) {
      // Use cache for simple pagination queries
      const end = Math.min(
        options.offset + options.limit,
        this.cachedEntries.length,
      );
      const items = this.cachedEntries.slice(options.offset, end);

      console.log(
        `Serving ${items.length} entries from cache (offset: ${options.offset}, limit: ${options.limit})`,
      );

      return {
        items,
        totalCount: this.cachedEntries.length,
      };
    }

    // For filtered queries or queries beyond cache, read from file
    console.log(`Reading from file for filtered/paginated query`);
    return await readLogFile(logFile, options);
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
export function createLogProvider(): LogProvider {
  if (globalForLogProvider.logProvider) {
    return globalForLogProvider.logProvider;
  }

  const logType = env.QUERY_LOG_TYPE?.toLowerCase();

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
    if (!db) {
      throw new Error("Database connection required for MySQL log provider");
    }

    provider = new MySQLLogProvider(db);
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
