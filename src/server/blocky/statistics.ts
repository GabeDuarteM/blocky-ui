import { type KyInstance } from "ky";
import { z } from "zod";

const countByNameSchema = z.record(z.string(), z.number());

const statisticsSchema = z.object({
  byResponseType: countByNameSchema,
  summary: z.object({
    queries: z.number(),
    cached: z.number(),
    forwarded: z.number(),
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

export async function readBlockyStatistics(client: KyInstance) {
  return statisticsSchema.parse(await client.get("api/stats").json());
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

export async function fetchBlockyStatistics(): Promise<BlockyStatistics | null> {
  const { blockyApi } = await import("~/server/blocky/client");
  try {
    return await readBlockyStatistics(blockyApi);
  } catch {
    return null;
  }
}
