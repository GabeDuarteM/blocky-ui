import { isEntryInScope } from "~/server/logs/scope";
import { type TimeRange } from "~/lib/constants";
import {
  type LogProvider,
  type LogScope,
  type QueryLogsOptions,
  type QueryLogFilters,
  type LogEntry,
  type QueriesOverTimeEntry,
  type TopDomainEntry,
  type TopClientEntry,
  type QueryTypeEntry,
} from "~/server/logs/types";
import {
  aggregateQueriesOverTime,
  aggregateTopDomains,
  aggregateTopClients,
  aggregateQueryTypes,
} from "~/server/logs/aggregation-utils";

interface CacheEntry {
  promise: Promise<LogEntry[]>;
  timestamp: number;
}

const CACHE_TTL_MS = 5000;

function filterByDomainAndClient(
  entries: LogEntry[],
  domain?: string,
  client?: string,
): LogEntry[] {
  let result = entries;

  if (domain) {
    const domainLower = domain.toLowerCase();
    result = result.filter((e) =>
      e.questionName?.toLowerCase().includes(domainLower),
    );
  }

  if (client) {
    const clientLower = client.toLowerCase();
    result = result.filter((e) =>
      e.clientName?.toLowerCase().includes(clientLower),
    );
  }

  return result;
}

function filterByBlocked(
  entries: LogEntry[],
  filter: "all" | "blocked",
): LogEntry[] {
  if (filter === "blocked") {
    return entries.filter((e) => e.responseType === "BLOCKED");
  }
  return entries;
}

/**
 * Base class for memory-based log providers that load entries into memory.
 * Provides caching and common aggregation method implementations.
 */
export abstract class BaseMemoryLogProvider implements LogProvider {
  private readonly entriesCache = new Map<TimeRange, CacheEntry>();

  abstract getQueryLogs(
    options: QueryLogsOptions,
  ): Promise<{ items: LogEntry[]; totalCount: number }>;

  async getQueryLogRows(options: QueryLogsOptions): Promise<LogEntry[]> {
    return (await this.getQueryLogs(options)).items;
  }

  async getQueryLogCount(options: QueryLogFilters): Promise<number> {
    return (await this.getQueryLogs({ ...options, limit: 0, offset: 0 }))
      .totalCount;
  }

  protected abstract fetchEntriesInRange(range: TimeRange): Promise<LogEntry[]>;

  protected async getEntriesInRange(
    range: TimeRange,
    scope: LogScope = {},
  ): Promise<LogEntry[]> {
    return (await this.getUnfilteredEntriesInRange(range)).filter((entry) =>
      isEntryInScope(entry, scope),
    );
  }

  private getUnfilteredEntriesInRange(range: TimeRange): Promise<LogEntry[]> {
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

  async getQueriesOverTime(
    options: LogScope & {
      range: TimeRange;
      domain?: string;
      client?: string;
    },
  ): Promise<QueriesOverTimeEntry[]> {
    const entries = await this.getEntriesInRange(options.range, options);
    const filtered = filterByDomainAndClient(
      entries,
      options.domain,
      options.client,
    );
    return aggregateQueriesOverTime(filtered, options.range);
  }

  async getTopDomains(
    options: LogScope & {
      range: TimeRange;
      limit?: number;
      offset: number;
      filter: "all" | "blocked";
    },
  ): Promise<{ items: TopDomainEntry[]; totalCount: number }> {
    const entries = await this.getEntriesInRange(options.range, options);
    const filtered = filterByBlocked(entries, options.filter);
    return aggregateTopDomains(
      filtered,
      options.limit ?? filtered.length,
      options.offset,
    );
  }

  async getTopClients(
    options: LogScope & {
      range: TimeRange;
      limit?: number;
      offset: number;
      filter: "all" | "blocked";
    },
  ): Promise<{ items: TopClientEntry[]; totalCount: number }> {
    const entries = await this.getEntriesInRange(options.range, options);
    const filtered = filterByBlocked(entries, options.filter);
    return aggregateTopClients(
      filtered,
      options.limit ?? filtered.length,
      options.offset,
    );
  }

  async getQueryTypesBreakdown(
    range: TimeRange,
    scope: LogScope = {},
  ): Promise<QueryTypeEntry[]> {
    const entries = await this.getEntriesInRange(range, scope);
    return aggregateQueryTypes(entries);
  }
}
