import { z } from "zod";
import { TIME_RANGES } from "~/lib/constants";
import { createTRPCRouter, publicProcedure } from "~/server/api/trpc";
import {
  checkPrometheusAvailable,
  extractBlockyMetrics,
  fetchPrometheusMetrics,
} from "~/server/prometheus/client";

const timeRangeSchema = z.enum(TIME_RANGES);

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
      listedDomains: totalDenylistEntries,
      hasLogProvider: !!ctx.logProvider,
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

  topDomains: publicProcedure
    .input(paginatedRangeSchema)
    .query(async ({ ctx, input }) => {
      if (!ctx.logProvider) return null;
      return ctx.logProvider.getTopDomains(input);
    }),

  topClients: publicProcedure
    .input(paginatedRangeSchema)
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
