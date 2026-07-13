import { z } from "zod";
import { TIME_RANGES } from "~/lib/constants";
import { createTRPCRouter, publicProcedure } from "~/server/api/trpc";
import {
  createStatisticsSnapshot,
  fetchBlockyStatistics,
} from "~/server/blocky/statistics";
import type { StatsResult } from "~/server/logs/types";

const timeRangeSchema = z.enum(TIME_RANGES);
const topListTypeSchema = z.enum(["domains", "clients"]);

const paginatedRangeSchema = z.object({
  range: timeRangeSchema,
  limit: z.number().min(1).max(100).default(10),
  offset: z.number().min(0).default(0),
  filter: z.enum(["all", "blocked"]).default("all"),
});

const searchSchema = z.object({
  range: timeRangeSchema,
  query: z.string().min(1),
  limit: z.number().min(1).max(50).default(10),
});

/**
 * Derives the overview's traffic counters from query-log totals.
 *
 * Mirrors blocky's own `curatedSummary()` (stats/collector.go): the cache hit
 * rate is measured against lookups (cached + forwarded) rather than all
 * queries, because a blocked or locally-answered query never consults the
 * cache. Averaging duration here — instead of in each provider — keeps the
 * result identical no matter which backend supplied the sums.
 */
function overviewFromLogs(stats: StatsResult) {
  const { totalQueries, blocked, cached, forwarded, durationSum } = stats;
  const lookups = cached + forwarded;

  return {
    totalQueries,
    blocked,
    blockedPercentage: totalQueries > 0 ? (blocked / totalQueries) * 100 : 0,
    cacheHitRate: lookups > 0 ? (cached / lookups) * 100 : 0,
    avgResponseMs:
      totalQueries > 0 ? Math.trunc(durationSum / totalQueries) : 0,
  };
}

export const statsRouter = createTRPCRouter({
  snapshot: publicProcedure.query(async ({ ctx }) => {
    if (!ctx.isDemoServiceAvailable("statistics")) {
      return null;
    }

    const statistics = await fetchBlockyStatistics();
    if (!statistics) {
      return null;
    }

    const snapshot = createStatisticsSnapshot(statistics);
    if (!ctx.logProvider) {
      return snapshot;
    }

    // Blocky's /api/stats is per-instance and in-memory: it only counts the
    // queries the responding instance served, and resets whenever it restarts.
    // When a query log is configured it spans every instance and survives
    // restarts, so prefer it for the traffic counters. The remaining fields
    // (cache size, list sizes) are current blocky state and stay as reported.
    const stats = await ctx.logProvider.getStats24h();
    return {
      ...snapshot,
      overview: { ...snapshot.overview, ...overviewFromLogs(stats) },
    };
  }),

  queriesOverTime: publicProcedure
    .input(
      z.object({
        range: timeRangeSchema,
        domain: z.string().optional(),
        client: z.string().optional(),
      }),
    )
    .query(async ({ ctx, input }) => {
      if (!ctx.logProvider) return null;
      return ctx.logProvider.getQueriesOverTime(input);
    }),

  topList: publicProcedure
    .input(paginatedRangeSchema.extend({ type: topListTypeSchema }))
    .query(async ({ ctx, input }) => {
      if (!ctx.logProvider) return null;

      const { type, ...options } = input;
      if (type === "domains") {
        const result = await ctx.logProvider.getTopDomains(options);
        return {
          ...result,
          items: result.items.map((item) => ({
            name: item.domain,
            count: item.count,
            blocked: item.blocked,
            percentage: item.percentage,
          })),
        };
      }

      const result = await ctx.logProvider.getTopClients(options);
      return {
        ...result,
        items: result.items.map((item) => ({
          name: item.client,
          count: item.total,
          blocked: item.blocked,
          percentage: item.percentage,
        })),
      };
    }),

  queryTypesBreakdown: publicProcedure
    .input(z.object({ range: timeRangeSchema }))
    .query(async ({ ctx, input }) => {
      if (!ctx.logProvider) return null;
      return ctx.logProvider.getQueryTypesBreakdown(input.range);
    }),

  searchDomains: publicProcedure
    .input(searchSchema)
    .query(async ({ ctx, input }) => {
      if (!ctx.logProvider) return null;
      return ctx.logProvider.searchDomains(input);
    }),

  searchClients: publicProcedure
    .input(searchSchema)
    .query(async ({ ctx, input }) => {
      if (!ctx.logProvider) return null;
      return ctx.logProvider.searchClients(input);
    }),
});
