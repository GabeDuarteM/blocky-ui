import { type TimeRange } from "~/lib/constants";
import {
  type LogEntry,
  type QueriesOverTimeEntry,
  type TopDomainEntry,
  type TopClientEntry,
  type QueryTypeEntry,
} from "~/server/logs/types";

export interface TimeRangeConfig {
  startTime: Date;
  interval: number;
}

export function getTimeRangeConfig(range: TimeRange): TimeRangeConfig {
  const now = Date.now();
  switch (range) {
    case "1h":
      return {
        startTime: new Date(now - 60 * 60 * 1000),
        interval: 5 * 60 * 1000,
      };
    case "24h":
      return {
        startTime: new Date(now - 24 * 60 * 60 * 1000),
        interval: 60 * 60 * 1000,
      };
    case "7d":
      return {
        startTime: new Date(now - 7 * 24 * 60 * 60 * 1000),
        interval: 6 * 60 * 60 * 1000,
      };
    case "30d":
      return {
        startTime: new Date(now - 30 * 24 * 60 * 60 * 1000),
        interval: 24 * 60 * 60 * 1000,
      };
  }
}

export function aggregateQueriesOverTime(
  entries: LogEntry[],
  range: TimeRange,
): QueriesOverTimeEntry[] {
  const { startTime, interval } = getTimeRangeConfig(range);
  const buckets = new Map<number, QueriesOverTimeEntry>();
  const now = Date.now();
  const firstBucket = Math.floor(startTime.getTime() / interval) * interval;
  for (let time = firstBucket; time <= now; time += interval) {
    buckets.set(time, {
      time: new Date(time).toISOString(),
      total: 0,
      blocked: 0,
      cached: 0,
    });
  }
  for (const entry of entries) {
    const time = new Date(entry.requestTs ?? 0).getTime();
    if (time < startTime.getTime() || time > now) {
      continue;
    }
    const bucket = buckets.get(Math.floor(time / interval) * interval);
    if (bucket) {
      bucket.total++;
      if (entry.responseType === "BLOCKED") {
        bucket.blocked++;
      }
      if (entry.responseType === "CACHED") {
        bucket.cached++;
      }
    }
  }
  return [...buckets.values()];
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
