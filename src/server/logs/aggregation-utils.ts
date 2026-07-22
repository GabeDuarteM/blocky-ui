import { type TimeRange } from "~/lib/constants";
import type {
  LogEntry,
  QueriesOverTimeEntry,
  StatsResult,
  TopDomainEntry,
  TopClientEntry,
  QueryTypeEntry,
  SearchDomainEntry,
  SearchClientEntry,
} from "./types";

/**
 * Response types that count as a cache hit or a forwarded lookup.
 *
 * These mirror blocky's own `categorize()` (stats/collector.go), which decides
 * how `/api/stats` buckets each response type. The cache hit rate is measured
 * against these two buckets, so keeping them aligned means a log-derived
 * overview reports the same rate blocky would.
 *
 * Note: blocky also folds FILTERED and NOTFQDN into "blocked", whereas this
 * codebase counts only BLOCKED throughout (query log filters, top domains,
 * queries-over-time). That difference is left alone here so "blocked" keeps one
 * meaning across the UI.
 */
export const CACHED_RESPONSE_TYPES = ["CACHED"];
export const FORWARDED_RESPONSE_TYPES = ["RESOLVED", "CONDITIONAL"];
export const BLOCKED_RESPONSE_TYPES = ["BLOCKED"];

export interface TimeRangeConfig {
  startTime: Date;
  interval: number;
  bucketCount: number;
}

export function getTimeRangeConfig(range: TimeRange): TimeRangeConfig {
  const now = Date.now();
  switch (range) {
    case "1h":
      return {
        startTime: new Date(now - 60 * 60 * 1000),
        interval: 5 * 60 * 1000,
        bucketCount: 12,
      };
    case "24h":
      return {
        startTime: new Date(now - 24 * 60 * 60 * 1000),
        interval: 60 * 60 * 1000,
        bucketCount: 24,
      };
    case "7d":
      return {
        startTime: new Date(now - 7 * 24 * 60 * 60 * 1000),
        interval: 6 * 60 * 60 * 1000,
        bucketCount: 28,
      };
    case "30d":
      return {
        startTime: new Date(now - 30 * 24 * 60 * 60 * 1000),
        interval: 24 * 60 * 60 * 1000,
        bucketCount: 30,
      };
  }
}

/**
 * Counts the last 24 hours of entries into blocky's outcome buckets.
 *
 * Returns `durationSum` rather than an average: summing integers is exact and
 * therefore identical across every provider, whereas each backend's own AVG()
 * rounds differently. Callers divide once, at the point of display.
 */
export function aggregateStats24h(entries: LogEntry[]): StatsResult {
  const { startTime } = getTimeRangeConfig("24h");
  const stats: StatsResult = {
    totalQueries: 0,
    blocked: 0,
    cached: 0,
    forwarded: 0,
    durationSum: 0,
  };

  for (const entry of entries) {
    const ts = entry.requestTs ? new Date(entry.requestTs).getTime() : 0;
    if (ts < startTime.getTime()) continue;

    stats.totalQueries++;
    stats.durationSum += entry.durationMs ?? 0;

    const rtype = entry.responseType ?? "";
    if (CACHED_RESPONSE_TYPES.includes(rtype)) stats.cached++;
    if (FORWARDED_RESPONSE_TYPES.includes(rtype)) stats.forwarded++;
    if (BLOCKED_RESPONSE_TYPES.includes(rtype)) stats.blocked++;
  }

  return stats;
}

export function aggregateQueriesOverTime(
  entries: LogEntry[],
  range: TimeRange,
): QueriesOverTimeEntry[] {
  const { startTime, interval, bucketCount } = getTimeRangeConfig(range);

  const buckets: Map<number, QueriesOverTimeEntry> = new Map();
  for (let i = 0; i < bucketCount; i++) {
    const time = new Date(startTime.getTime() + i * interval);
    buckets.set(i, {
      time: time.toISOString(),
      total: 0,
      blocked: 0,
      cached: 0,
    });
  }

  for (const entry of entries) {
    const entryTime = new Date(entry.requestTs ?? 0).getTime();
    const bucketIndex = Math.floor(
      (entryTime - startTime.getTime()) / interval,
    );
    if (bucketIndex >= 0 && bucketIndex < bucketCount) {
      const bucket = buckets.get(bucketIndex);
      if (bucket) {
        bucket.total++;
        if (entry.responseType === "BLOCKED") bucket.blocked++;
        if (entry.responseType === "CACHED") bucket.cached++;
      }
    }
  }

  return Array.from(buckets.values());
}

export function aggregateTopDomains(
  entries: LogEntry[],
  limit: number,
  offset: number,
): { items: TopDomainEntry[]; totalCount: number } {
  const domainStats = new Map<string, { count: number; blocked: number }>();
  for (const entry of entries) {
    const domain = entry.questionName ?? "unknown";
    const stats = domainStats.get(domain) ?? { count: 0, blocked: 0 };
    stats.count++;
    if (entry.responseType === "BLOCKED") stats.blocked++;
    domainStats.set(domain, stats);
  }

  const totalQueriesCount = entries.length;
  const sortedDomains = Array.from(domainStats.entries()).sort(
    (a, b) => b[1].count - a[1].count || a[0].localeCompare(b[0]),
  );

  return {
    items: sortedDomains
      .slice(offset, offset + limit)
      .map(([domain, stats]) => ({
        domain,
        count: stats.count,
        blocked: stats.blocked,
        percentage:
          totalQueriesCount > 0 ? (stats.count / totalQueriesCount) * 100 : 0,
      })),
    totalCount: sortedDomains.length,
  };
}

export function aggregateTopClients(
  entries: LogEntry[],
  limit: number,
  offset: number,
): { items: TopClientEntry[]; totalCount: number } {
  const clientStats = new Map<string, { total: number; blocked: number }>();
  for (const entry of entries) {
    const client = entry.clientName ?? "unknown";
    const stats = clientStats.get(client) ?? { total: 0, blocked: 0 };
    stats.total++;
    if (entry.responseType === "BLOCKED") stats.blocked++;
    clientStats.set(client, stats);
  }

  const totalQueriesCount = entries.length;
  const sortedClients = Array.from(clientStats.entries()).sort(
    (a, b) => b[1].total - a[1].total || a[0].localeCompare(b[0]),
  );

  return {
    items: sortedClients
      .slice(offset, offset + limit)
      .map(([client, stats]) => ({
        client,
        total: stats.total,
        blocked: stats.blocked,
        percentage:
          totalQueriesCount > 0 ? (stats.total / totalQueriesCount) * 100 : 0,
      })),
    totalCount: sortedClients.length,
  };
}

export function aggregateQueryTypes(entries: LogEntry[]): QueryTypeEntry[] {
  const typeCounts = new Map<string, number>();
  for (const entry of entries) {
    const type = entry.questionType ?? "unknown";
    typeCounts.set(type, (typeCounts.get(type) ?? 0) + 1);
  }

  const totalCount = entries.length;
  return Array.from(typeCounts.entries())
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([type, count]) => ({
      type,
      count,
      percentage: totalCount > 0 ? (count / totalCount) * 100 : 0,
    }));
}

export function searchDomainsInEntries(
  entries: LogEntry[],
  query: string,
  limit: number,
): SearchDomainEntry[] {
  if (!query.trim()) {
    return [];
  }

  const queryLower = query.toLowerCase();
  const domainCounts = new Map<string, number>();

  for (const entry of entries) {
    const domain = entry.questionName;
    if (!domain?.toLowerCase().includes(queryLower)) continue;
    domainCounts.set(domain, (domainCounts.get(domain) ?? 0) + 1);
  }

  return Array.from(domainCounts.entries())
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, limit)
    .map(([domain, count]) => ({ domain, count }));
}

export function searchClientsInEntries(
  entries: LogEntry[],
  query: string,
  limit: number,
): SearchClientEntry[] {
  if (!query.trim()) {
    return [];
  }

  const queryLower = query.toLowerCase();
  const clientCounts = new Map<string, number>();

  for (const entry of entries) {
    const client = entry.clientName;
    if (!client?.toLowerCase().includes(queryLower)) continue;
    clientCounts.set(client, (clientCounts.get(client) ?? 0) + 1);
  }

  return Array.from(clientCounts.entries())
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, limit)
    .map(([client, count]) => ({ client, count }));
}
