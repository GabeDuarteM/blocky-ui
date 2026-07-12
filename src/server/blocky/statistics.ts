import { z } from "zod";

import { blockyApi } from "~/server/blocky/client";

const countByNameSchema = z.record(z.string(), z.number());

const statisticsSchema = z.object({
  summary: z.object({
    queries: z.number(),
    blocked: z.number(),
    dropped: z.number(),
    errors: z.number(),
    avgResponseMs: z.number(),
    cacheHitRate: z.number(),
  }),
  topDomains: z.array(z.object({ name: z.string(), count: z.number() })),
  topBlockedDomains: z.array(z.object({ name: z.string(), count: z.number() })),
  topClients: z.array(z.object({ name: z.string(), count: z.number() })),
  lists: z.object({
    denylist: countByNameSchema,
    allowlist: countByNameSchema,
  }),
  cache: z.object({
    entries: z.number(),
  }),
});

export type BlockyStatistics = z.infer<typeof statisticsSchema>;

export function parseBlockyStatistics(value: unknown): BlockyStatistics | null {
  const result = statisticsSchema.safeParse(value);
  return result.success ? result.data : null;
}

export async function fetchBlockyStatistics(): Promise<BlockyStatistics | null> {
  try {
    const response = await blockyApi.get("api/stats", {
      throwHttpErrors: false,
    });
    if (!response.ok) {
      return null;
    }

    return parseBlockyStatistics(await response.json());
  } catch {
    return null;
  }
}

export function createStatisticsSnapshot(statistics: BlockyStatistics) {
  const { summary } = statistics;
  const blockedPercentage =
    summary.queries > 0 ? (summary.blocked / summary.queries) * 100 : 0;
  const listedDomains = Object.values(statistics.lists.denylist).reduce(
    (total, count) => total + count,
    0,
  );
  const allowlistDomains = Object.values(statistics.lists.allowlist).reduce(
    (total, count) => total + count,
    0,
  );

  return {
    overview: {
      totalQueries: summary.queries,
      blocked: summary.blocked,
      dropped: summary.dropped,
      errors: summary.errors,
      blockedPercentage,
      cacheHitRate: summary.cacheHitRate * 100,
      listedDomains,
      avgResponseMs: summary.avgResponseMs,
      cacheEntries: statistics.cache.entries,
      denylistGroups: Object.keys(statistics.lists.denylist).length,
      allowlistDomains,
    },
    topLists: {
      domains: statistics.topDomains,
      blockedDomains: statistics.topBlockedDomains,
      clients: statistics.topClients,
    },
  };
}
