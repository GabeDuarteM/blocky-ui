import { z } from "zod";
import { TIME_RANGES } from "~/lib/constants";
import { createTRPCRouter, publicProcedure } from "~/server/api/trpc";
import {
  checkPrometheusAvailable,
  extractBlockyMetrics,
  fetchPrometheusMetrics,
} from "~/server/prometheus/client";

const timeRangeSchema = z.enum(TIME_RANGES);

export const statsRouter = createTRPCRouter({
  prometheusStatus: publicProcedure.query(async () => {
    const available = await checkPrometheusAvailable();
    return { available };
  }),

  overview: publicProcedure.query(async ({ ctx }) => {
    const parsed = await fetchPrometheusMetrics();
    if (!parsed) return null;

    const metrics = extractBlockyMetrics(parsed);
    const totalDenylistEntries = metrics.denylistEntries.reduce(
      (sum, e) => sum + e.count,
      0,
    );
    const cacheHitRate =
      metrics.cacheHits + metrics.cacheMisses > 0
        ? (metrics.cacheHits / (metrics.cacheHits + metrics.cacheMisses)) * 100
        : 0;

    const stats24h = await ctx.logProvider?.getStats24h();
    const totalQueries = stats24h?.totalQueries ?? metrics.queryTotal;
    const blocked = stats24h?.blocked ?? metrics.blocked;
    const blockedPercentage =
      totalQueries > 0 ? (blocked / totalQueries) * 100 : 0;

    return {
      totalQueries,
      blocked,
      blockedPercentage,
      cacheHitRate,
      cacheEntries: metrics.cacheEntries,
      listedDomains: totalDenylistEntries,
      errors: metrics.errors,
      hasLogProvider: !!ctx.logProvider,
    };
  }),

  listStatus: publicProcedure.query(async () => {
    const parsed = await fetchPrometheusMetrics();
    if (!parsed) return null;

    const metrics = extractBlockyMetrics(parsed);
    const groups = metrics.denylistEntries.map((deny) => {
      const allow = metrics.allowlistEntries.find(
        (a) => a.group === deny.group,
      );
      return {
        name: deny.group,
        denylistCount: deny.count,
        allowlistCount: allow?.count ?? 0,
      };
    });

    const total = groups.reduce(
      (sum, g) => sum + g.denylistCount + g.allowlistCount,
      0,
    );

    return { groups, total };
  }),

  buildInfo: publicProcedure.query(async () => {
    const parsed = await fetchPrometheusMetrics();
    if (!parsed) return null;

    const metrics = extractBlockyMetrics(parsed);
    return metrics.buildInfo;
  }),

  queriesOverTime: publicProcedure
    .input(z.object({ range: timeRangeSchema }))
    .query(async ({ ctx, input }) => {
      if (!ctx.logProvider) return null;
      return ctx.logProvider.getQueriesOverTime(input.range);
    }),

  topDomains: publicProcedure
    .input(
      z.object({
        range: timeRangeSchema,
        limit: z.number().min(1).max(100).default(10),
        filter: z.enum(["all", "blocked"]).default("all"),
      }),
    )
    .query(async ({ ctx, input }) => {
      if (!ctx.logProvider) return null;
      return ctx.logProvider.getTopDomains(input);
    }),

  topClients: publicProcedure
    .input(
      z.object({
        range: timeRangeSchema,
        limit: z.number().min(1).max(100).default(10),
      }),
    )
    .query(async ({ ctx, input }) => {
      if (!ctx.logProvider) return null;
      return ctx.logProvider.getTopClients(input);
    }),

  queryTypesBreakdown: publicProcedure
    .input(z.object({ range: timeRangeSchema }))
    .query(async ({ ctx, input }) => {
      if (!ctx.logProvider) return null;
      return ctx.logProvider.getQueryTypesBreakdown(input.range);
    }),
});
