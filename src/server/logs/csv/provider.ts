import * as fs from "fs";
import * as path from "path";
import { type TimeRange } from "~/lib/constants";
import type {
  LogEntry,
  StatsResult,
  QueryLogsOptions,
  QueryLogsResult,
} from "../types";
import { getTimeRangeConfig } from "../aggregation-utils";
import { BaseMemoryLogProvider } from "../base-provider";
import {
  streamAndParseEntries,
  createFilterFn,
  createTimeFilter,
  computeStats,
} from "./utils";

/**
 * CSV file-based log provider
 * Reads directly from the latest log file on each request using buffered streaming
 */
export class CsvLogProvider extends BaseMemoryLogProvider {
  private readonly directory: string;

  constructor(options: { directory: string }) {
    super();
    this.directory = options.directory;
  }

  async getQueryLogs(options: QueryLogsOptions): Promise<QueryLogsResult> {
    const logFile = await this.findLatestLogFile({ throwOnError: true });

    if (!logFile) {
      return { items: [], totalCount: 0 };
    }

    return await this.readLogFile(logFile, options);
  }

  private async findLatestLogFile(options?: {
    throwOnError?: boolean;
  }): Promise<string | null> {
    try {
      if (!fs.existsSync(this.directory)) {
        const message = `CSV log directory not found: ${this.directory}`;
        console.error(message);
        if (options?.throwOnError) {
          throw new Error(message);
        }
        return null;
      }

      const files = await fs.promises.readdir(this.directory);
      const logFiles = files.filter((file) => file.endsWith(".log"));

      if (logFiles.length === 0) {
        return null;
      }

      let latestFile: string | null = null;
      let latestMtime = 0;

      for (const file of logFiles) {
        const filePath = path.join(this.directory, file);
        const stats = await fs.promises.stat(filePath);

        if (stats.mtimeMs > latestMtime) {
          latestMtime = stats.mtimeMs;
          latestFile = filePath;
        }
      }

      return latestFile;
    } catch (error) {
      console.error("Error finding latest log file:", error);
      if (options?.throwOnError) {
        throw error;
      }
      return null;
    }
  }

  private async readLogFile(
    filePath: string,
    options: QueryLogsOptions,
  ): Promise<QueryLogsResult> {
    const filterFn = createFilterFn(options);
    const filteredEntries = await streamAndParseEntries(filePath, filterFn);
    filteredEntries.reverse();

    const totalCount = filteredEntries.length;
    const paginatedEntries = filteredEntries.slice(
      options.offset,
      options.offset + options.limit,
    );

    return {
      items: paginatedEntries,
      totalCount,
    };
  }

  async getStats24h(): Promise<StatsResult> {
    const logFile = await this.findLatestLogFile();
    if (!logFile) {
      return { totalQueries: 0, blocked: 0 };
    }

    try {
      const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const entries = await streamAndParseEntries(
        logFile,
        createTimeFilter(oneDayAgo),
      );
      return computeStats(entries);
    } catch (error) {
      console.error("Error getting stats:", error);
      return { totalQueries: 0, blocked: 0 };
    }
  }

  protected async fetchEntriesInRange(range: TimeRange): Promise<LogEntry[]> {
    const logFile = await this.findLatestLogFile();
    if (!logFile) return [];

    const { startTime } = getTimeRangeConfig(range);
    return streamAndParseEntries(logFile, createTimeFilter(startTime));
  }
}
