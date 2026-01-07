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

  abstract getQueryLogs(options: {
    limit: number;
    offset: number;
    search?: string;
    responseType?: string;
    client?: string;
  }): Promise<{ items: LogEntry[]; totalCount: number }>;

  abstract getStats24h(): Promise<StatsResult>;

  protected abstract fetchEntriesInRange(range: TimeRange): Promise<LogEntry[]>;

  protected getEntriesInRange(range: TimeRange): Promise<LogEntry[]> {
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

  async getQueriesOverTime(options: {
    range: TimeRange;
    domain?: string;
    client?: string;
  }): Promise<QueriesOverTimeEntry[]> {
    const entries = await this.getEntriesInRange(options.range);
    const filtered = filterByDomainAndClient(
      entries,
      options.domain,
      options.client,
    );
    return aggregateQueriesOverTime(filtered, options.range);
  }

  async getTopDomains(options: {
    range: TimeRange;
    limit: number;
    offset: number;
    filter: "all" | "blocked";
  }): Promise<{ items: TopDomainEntry[]; totalCount: number }> {
    const entries = await this.getEntriesInRange(options.range);
    const filtered = filterByBlocked(entries, options.filter);
    return aggregateTopDomains(filtered, options.limit, options.offset);
  }

  async getTopClients(options: {
    range: TimeRange;
    limit: number;
    offset: number;
    filter: "all" | "blocked";
  }): Promise<{ items: TopClientEntry[]; totalCount: number }> {
    const entries = await this.getEntriesInRange(options.range);
    const filtered = filterByBlocked(entries, options.filter);
    return aggregateTopClients(filtered, options.limit, options.offset);
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
