import * as fs from "fs";
import * as path from "path";
import { type TimeRange } from "~/lib/constants";
import type {
  LogProvider,
  LogEntry,
  StatsResult,
  QueriesOverTimeEntry,
  TopDomainEntry,
  TopClientEntry,
  QueryTypeEntry,
  SearchDomainEntry,
  SearchClientEntry,
} from "../types";
import {
  getTimeRangeConfig,
  aggregateQueriesOverTime,
  aggregateTopDomains,
  aggregateTopClients,
  aggregateQueryTypes,
  searchDomainsInEntries,
  searchClientsInEntries,
} from "../aggregation-utils";
import { streamAndParseEntries, createFilterFn } from "./utils";

interface CacheEntry {
  promise: Promise<LogEntry[]>;
  timestamp: number;
}

const CACHE_TTL_MS = 5000; // 5 seconds

const DATE_PATTERN = /^(\d{4}-\d{2}-\d{2})_.+\.log$/;

/**
 * CSV file-based log provider for per-client log files
 * Aggregates logs from multiple files for the most recent date
 * (e.g., YYYY-MM-DD_laptop.log, YYYY-MM-DD_phone.log)
 */
export class CsvClientLogProvider implements LogProvider {
  private readonly directory: string;
  private readonly entriesCache = new Map<TimeRange, CacheEntry>();

  constructor(options: { directory: string }) {
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

      const isWithin24h = (entry: LogEntry): boolean => {
        if (!entry.requestTs) return false;
        const entryDate = new Date(entry.requestTs);
        return entryDate >= oneDayAgo;
      };

      const entriesArrays = await Promise.all(
        logFiles.map((filePath) =>
          streamAndParseEntries(filePath, isWithin24h),
        ),
      );

      const entries = entriesArrays.flat();
      const blocked = entries.filter(
        (e) => e.responseType === "BLOCKED",
      ).length;

      return {
        totalQueries: entries.length,
        blocked,
      };
    } catch (error) {
      console.error(`Error getting stats:`, error);
      return { totalQueries: 0, blocked: 0 };
    }
  }

  private getEntriesInRange(range: TimeRange): Promise<LogEntry[]> {
    const cached = this.entriesCache.get(range);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
      return cached.promise;
    }

    const promise = this.fetchEntriesInRange(range);
    promise.catch(() => {
      const current = this.entriesCache.get(range);
      if (current?.promise === promise) {
        this.entriesCache.delete(range);
      }
    });
    this.entriesCache.set(range, { promise, timestamp: Date.now() });

    return promise;
  }

  private async fetchEntriesInRange(range: TimeRange): Promise<LogEntry[]> {
    const logFiles = await this.findLatestDateFiles();
    if (logFiles.length === 0) return [];

    const { startTime } = getTimeRangeConfig(range);

    const isInRange = (entry: LogEntry): boolean => {
      if (!entry.requestTs) return false;
      const entryDate = new Date(entry.requestTs);
      return entryDate >= startTime;
    };

    const entriesArrays = await Promise.all(
      logFiles.map((filePath) => streamAndParseEntries(filePath, isInRange)),
    );

    return entriesArrays.flat();
  }

  async getQueriesOverTime(options: {
    range: TimeRange;
    domain?: string;
    client?: string;
  }): Promise<QueriesOverTimeEntry[]> {
    let entries = await this.getEntriesInRange(options.range);

    if (options.domain) {
      const domainLower = options.domain.toLowerCase();
      entries = entries.filter((e) =>
        e.questionName?.toLowerCase().includes(domainLower),
      );
    }

    if (options.client) {
      const clientLower = options.client.toLowerCase();
      entries = entries.filter((e) =>
        e.clientName?.toLowerCase().includes(clientLower),
      );
    }

    return aggregateQueriesOverTime(entries, options.range);
  }

  async getTopDomains(options: {
    range: TimeRange;
    limit: number;
    offset: number;
    filter: "all" | "blocked";
  }): Promise<{ items: TopDomainEntry[]; totalCount: number }> {
    let entries = await this.getEntriesInRange(options.range);
    if (options.filter === "blocked") {
      entries = entries.filter((e) => e.responseType === "BLOCKED");
    }
    return aggregateTopDomains(entries, options.limit, options.offset);
  }

  async getTopClients(options: {
    range: TimeRange;
    limit: number;
    offset: number;
    filter: "all" | "blocked";
  }): Promise<{ items: TopClientEntry[]; totalCount: number }> {
    let entries = await this.getEntriesInRange(options.range);
    if (options.filter === "blocked") {
      entries = entries.filter((e) => e.responseType === "BLOCKED");
    }
    return aggregateTopClients(entries, options.limit, options.offset);
  }

  async getQueryTypesBreakdown(range: TimeRange): Promise<QueryTypeEntry[]> {
    const entries = await this.getEntriesInRange(range);
    return aggregateQueryTypes(entries);
  }

  async searchDomains(options: {
    range: TimeRange;
    query: string;
    limit: number;
  }): Promise<SearchDomainEntry[]> {
    const entries = await this.getEntriesInRange(options.range);
    return searchDomainsInEntries(entries, options.query, options.limit);
  }

  async searchClients(options: {
    range: TimeRange;
    query: string;
    limit: number;
  }): Promise<SearchClientEntry[]> {
    const entries = await this.getEntriesInRange(options.range);
    return searchClientsInEntries(entries, options.query, options.limit);
  }
}
