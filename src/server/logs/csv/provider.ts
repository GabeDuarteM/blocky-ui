import * as fs from "fs";
import * as path from "path";
import { type TimeRange } from "~/lib/constants";
import {
  type LogEntry,
  type QueryLogsOptions,
  type QueryLogsResult,
} from "~/server/logs/types";
import { getTimeRangeConfig } from "~/server/logs/aggregation-utils";
import { BaseMemoryLogProvider } from "~/server/logs/base-provider";
import {
  streamAndParseEntries,
  createFilterFn,
  createTimeFilter,
} from "~/server/logs/csv/utils";

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
    filteredEntries.sort(
      (a, b) =>
        new Date(b.requestTs ?? 0).getTime() -
        new Date(a.requestTs ?? 0).getTime(),
    );

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

  protected async fetchEntriesInRange(range: TimeRange): Promise<LogEntry[]> {
    const logFile = await this.findLatestLogFile({ throwOnError: true });
    if (!logFile) return [];

    const { startTime } = getTimeRangeConfig(range);
    return streamAndParseEntries(logFile, createTimeFilter(startTime));
  }
}
