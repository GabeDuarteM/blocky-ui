import * as fs from "fs";
import * as path from "path";
import * as readline from "readline";
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
} from "./types";
import {
  getTimeRangeConfig,
  aggregateQueriesOverTime,
  aggregateTopDomains,
  aggregateTopClients,
  aggregateQueryTypes,
  searchDomainsInEntries,
  searchClientsInEntries,
} from "./aggregation-utils";

interface CacheEntry {
  promise: Promise<LogEntry[]>;
  timestamp: number;
}

const CACHE_TTL_MS = 5000; // 5 seconds

/**
 * CSV file-based log provider
 * Reads directly from the latest log file on each request using buffered streaming
 */
export class CsvLogProvider implements LogProvider {
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
    const logFile = await this.findLatestLogFile();

    if (!logFile) {
      return { items: [], totalCount: 0 };
    }

    return await this.readLogFile(logFile, options);
  }

  private async findLatestLogFile(): Promise<string | null> {
    try {
      if (!fs.existsSync(this.directory)) {
        console.error(`Directory not found: ${this.directory}`);
        return null;
      }

      const files = await fs.promises.readdir(this.directory);
      const logFiles = files.filter((file) => file.endsWith(".log"));

      if (logFiles.length === 0) {
        console.error(`No *.log files found in directory: ${this.directory}`);
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
      console.error(`Error finding latest log file:`, error);
      return null;
    }
  }

  private parseLogLine(line: string): LogEntry | null {
    try {
      const trimmed = line.trim();
      if (!trimmed) return null;

      const fields = trimmed.split("\t");

      // Expected format: timestamp, clientIP, clientName, duration, reason, questionName, answer, responseCode, responseType, questionType, hostnameId
      if (fields.length < 11) {
        console.warn(
          `Malformed log line (expected 11+ fields, got ${fields.length}):`,
          line,
        );
        return null;
      }

      const parsedDuration = fields[3] ? parseInt(fields[3], 10) : NaN;

      return {
        requestTs: fields[0] || null,
        clientIp: fields[1] || null,
        clientName: fields[2] || null,
        durationMs: Number.isNaN(parsedDuration) ? null : parsedDuration,
        reason: fields[4] || null,
        questionName: fields[5] || null,
        answer: fields[6] || null,
        responseCode: fields[7] || null,
        responseType: fields[8] || null,
        questionType: fields[9] || null,
        hostname: fields[10] || null,
        effectiveTldp: null,
        id: null,
      };
    } catch (error) {
      console.error(`Error parsing log line:`, error);
      return null;
    }
  }

  private streamAndParseEntries(
    stream: fs.ReadStream,
    filterFn?: (entry: LogEntry) => boolean,
  ): Promise<LogEntry[]> {
    return new Promise((resolve, reject) => {
      const entries: LogEntry[] = [];

      const rl = readline.createInterface({
        input: stream,
        crlfDelay: Infinity,
      });

      rl.on("line", (line) => {
        const entry = this.parseLogLine(line);
        if (!entry) return;

        if (!filterFn || filterFn(entry)) {
          entries.push(entry);
        }
      });

      rl.on("close", () => {
        resolve(entries);
      });

      stream.on("error", (error) => {
        reject(error);
      });
    });
  }

  private async readLogFile(
    filePath: string,
    options: {
      limit: number;
      offset: number;
      search?: string;
      responseType?: string;
    },
  ): Promise<{ items: LogEntry[]; totalCount: number }> {
    try {
      const searchLower = options.search?.toLowerCase();

      const passesFilters = (entry: LogEntry): boolean => {
        const passesSearch =
          !searchLower ||
          entry.questionName?.toLowerCase().includes(searchLower) === true;
        const passesType =
          !options.responseType || entry.responseType === options.responseType;
        return passesSearch && passesType;
      };

      const stream = fs.createReadStream(filePath, {
        encoding: "utf-8",
        highWaterMark: 64 * 1024, // 64KB chunks
      });

      const filteredEntries = await this.streamAndParseEntries(
        stream,
        passesFilters,
      );
      filteredEntries.reverse(); // to show most recent first

      const totalCount = filteredEntries.length;
      const paginatedEntries = filteredEntries.slice(
        options.offset,
        options.offset + options.limit,
      );

      return {
        items: paginatedEntries,
        totalCount,
      };
    } catch (error) {
      console.error(`Error reading log file:`, error);
      return { items: [], totalCount: 0 };
    }
  }

  async getStats24h(): Promise<StatsResult> {
    const logFile = await this.findLatestLogFile();

    if (!logFile) {
      return { totalQueries: 0, blocked: 0 };
    }

    try {
      const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

      const isWithin24h = (entry: LogEntry): boolean => {
        if (!entry.requestTs) return false;
        const entryDate = new Date(entry.requestTs);
        return entryDate >= oneDayAgo;
      };

      const stream = fs.createReadStream(logFile, {
        encoding: "utf-8",
        highWaterMark: 64 * 1024,
      });

      const entries = await this.streamAndParseEntries(stream, isWithin24h);
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
    const logFile = await this.findLatestLogFile();
    if (!logFile) return [];

    const { startTime } = getTimeRangeConfig(range);

    const isInRange = (entry: LogEntry): boolean => {
      if (!entry.requestTs) return false;
      const entryDate = new Date(entry.requestTs);
      return entryDate >= startTime;
    };

    const stream = fs.createReadStream(logFile, {
      encoding: "utf-8",
      highWaterMark: 64 * 1024,
    });

    return this.streamAndParseEntries(stream, isInRange);
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
