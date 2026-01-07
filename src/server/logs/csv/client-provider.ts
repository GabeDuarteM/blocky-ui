import * as fs from "fs";
import * as path from "path";
import { type TimeRange } from "~/lib/constants";
import type { LogEntry, StatsResult } from "../types";
import { getTimeRangeConfig } from "../aggregation-utils";
import { BaseMemoryLogProvider } from "../base-provider";
import {
  streamAndParseEntries,
  createFilterFn,
  createTimeFilter,
  computeStats,
} from "./utils";

const DATE_PATTERN = /^(\d{4}-\d{2}-\d{2})_.+\.log$/;

/**
 * CSV file-based log provider for per-client log files
 * Aggregates logs from multiple files for the most recent date
 * (e.g., YYYY-MM-DD_laptop.log, YYYY-MM-DD_phone.log)
 */
export class CsvClientLogProvider extends BaseMemoryLogProvider {
  private readonly directory: string;

  constructor(options: { directory: string }) {
    super();
    this.directory = options.directory;
  }

  async getQueryLogs(options: {
    limit: number;
    offset: number;
    search?: string;
    responseType?: string;
  }): Promise<{ items: LogEntry[]; totalCount: number }> {
    const logFiles = await this.findLatestDateFiles();

    if (logFiles.length === 0) {
      return { items: [], totalCount: 0 };
    }

    return await this.readAndMergeLogFiles(logFiles, options);
  }

  private async findLatestDateFiles(): Promise<string[]> {
    try {
      if (!fs.existsSync(this.directory)) {
        console.error(`Directory not found: ${this.directory}`);
        return [];
      }

      const files = await fs.promises.readdir(this.directory);
      const logFiles = files.filter((file) => file.endsWith(".log"));

      if (logFiles.length === 0) {
        console.error(`No *.log files found in directory: ${this.directory}`);
        return [];
      }

      const filesByDate = new Map<string, string[]>();

      for (const file of logFiles) {
        const match = DATE_PATTERN.exec(file);
        if (match?.[1]) {
          const date = match[1];
          const existing = filesByDate.get(date) ?? [];
          existing.push(path.join(this.directory, file));
          filesByDate.set(date, existing);
        }
      }

      if (filesByDate.size === 0) {
        console.error(
          `No files matching YYYY-MM-DD_*.log pattern found in: ${this.directory}`,
        );
        return [];
      }

      const sortedDates = Array.from(filesByDate.keys()).sort().reverse();
      const latestDate = sortedDates[0];

      if (!latestDate) {
        return [];
      }

      return filesByDate.get(latestDate) ?? [];
    } catch (error) {
      console.error(`Error finding latest date files:`, error);
      return [];
    }
  }

  private async readAndMergeLogFiles(
    filePaths: string[],
    options: {
      limit: number;
      offset: number;
      search?: string;
      responseType?: string;
    },
  ): Promise<{ items: LogEntry[]; totalCount: number }> {
    try {
      const filterFn = createFilterFn(options);

      const entriesArrays = await Promise.all(
        filePaths.map((filePath) => streamAndParseEntries(filePath, filterFn)),
      );

      const allEntries = entriesArrays.flat();

      allEntries.sort((a, b) => {
        const tsA = a.requestTs ?? "";
        const tsB = b.requestTs ?? "";
        return tsB.localeCompare(tsA);
      });

      const totalCount = allEntries.length;
      const paginatedEntries = allEntries.slice(
        options.offset,
        options.offset + options.limit,
      );

      return {
        items: paginatedEntries,
        totalCount,
      };
    } catch (error) {
      console.error(`Error reading log files:`, error);
      return { items: [], totalCount: 0 };
    }
  }

  async getStats24h(): Promise<StatsResult> {
    const logFiles = await this.findLatestDateFiles();
    if (logFiles.length === 0) {
      return { totalQueries: 0, blocked: 0 };
    }

    try {
      const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const filterFn = createTimeFilter(oneDayAgo);
      const entriesArrays = await Promise.all(
        logFiles.map((filePath) => streamAndParseEntries(filePath, filterFn)),
      );
      return computeStats(entriesArrays.flat());
    } catch (error) {
      console.error(`Error getting stats:`, error);
      return { totalQueries: 0, blocked: 0 };
    }
  }

  protected async fetchEntriesInRange(range: TimeRange): Promise<LogEntry[]> {
    const logFiles = await this.findLatestDateFiles();
    if (logFiles.length === 0) return [];

    const { startTime } = getTimeRangeConfig(range);
    const filterFn = createTimeFilter(startTime);
    const entriesArrays = await Promise.all(
      logFiles.map((filePath) => streamAndParseEntries(filePath, filterFn)),
    );

    return entriesArrays.flat();
  }
}
