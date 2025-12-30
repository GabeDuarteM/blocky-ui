import { type TimeRange } from "~/lib/constants";
import type {
  LogEntry,
  QueriesOverTimeEntry,
  TopDomainEntry,
  TopClientEntry,
  QueryTypeEntry,
} from "./types";

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
): TopDomainEntry[] {
  const domainStats = new Map<string, { count: number; blocked: number }>();
  for (const entry of entries) {
    const domain = entry.questionName ?? "unknown";
    const stats = domainStats.get(domain) ?? { count: 0, blocked: 0 };
    stats.count++;
    if (entry.responseType === "BLOCKED") stats.blocked++;
    domainStats.set(domain, stats);
  }

  const totalCount = entries.length;
  return Array.from(domainStats.entries())
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, limit)
    .map(([domain, stats]) => ({
      domain,
      count: stats.count,
      blocked: stats.blocked,
      percentage: totalCount > 0 ? (stats.count / totalCount) * 100 : 0,
    }));
}

export function aggregateTopClients(
  entries: LogEntry[],
  limit: number,
): TopClientEntry[] {
  const clientStats = new Map<string, { total: number; blocked: number }>();
  for (const entry of entries) {
    const client = entry.clientName ?? "unknown";
    const stats = clientStats.get(client) ?? { total: 0, blocked: 0 };
    stats.total++;
    if (entry.responseType === "BLOCKED") stats.blocked++;
    clientStats.set(client, stats);
  }

  const totalCount = entries.length;
  return Array.from(clientStats.entries())
    .sort((a, b) => b[1].total - a[1].total)
    .slice(0, limit)
    .map(([client, stats]) => ({
      client,
      total: stats.total,
      blocked: stats.blocked,
      percentage: totalCount > 0 ? (stats.total / totalCount) * 100 : 0,
    }));
}

export function aggregateQueryTypes(entries: LogEntry[]): QueryTypeEntry[] {
  const typeCounts = new Map<string, number>();
  for (const entry of entries) {
    const type = entry.questionType ?? "unknown";
    typeCounts.set(type, (typeCounts.get(type) ?? 0) + 1);
  }

  const totalCount = entries.length;
  return Array.from(typeCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([type, count]) => ({
      type,
      count,
      percentage: totalCount > 0 ? (count / totalCount) * 100 : 0,
    }));
}
