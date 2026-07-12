import { z } from "zod";
import { TIME_RANGES } from "~/lib/constants";
import { createTRPCRouter, publicProcedure } from "~/server/api/trpc";
import {
  createStatisticsSnapshot,
  fetchBlockyStatistics,
} from "~/server/blocky/statistics";

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

export const statsRouter = createTRPCRouter({
  snapshot: publicProcedure.query(async ({ ctx }) => {
    if (!ctx.isDemoServiceAvailable("statistics")) {
      return null;
    }

    const statistics = await fetchBlockyStatistics();
    if (!statistics) {
      return null;
    }
    return createStatisticsSnapshot(statistics);
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
