import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { TIME_RANGES } from "~/lib/constants";
import { createTRPCRouter, publicProcedure } from "~/server/api/trpc";

const logProcedure = publicProcedure.use(({ ctx, next }) => {
  if (!ctx.isDemoServiceAvailable("queryLogs")) {
    throw new TRPCError({
      code: "SERVICE_UNAVAILABLE",
      message: "Query logs are unavailable.",
    });
  }
  return next();
});

const scopeSchema = z.object({ serverIds: z.array(z.string()).min(1) });
const rangeSchema = scopeSchema.extend({ range: z.enum(TIME_RANGES) });
const filtersSchema = scopeSchema.extend({
  search: z.string().optional(),
  client: z.string().optional(),
  questionType: z.string().optional(),
  responseType: z.string().optional(),
});

export const logsRouter = createTRPCRouter({
  rows: logProcedure
    .input(
      filtersSchema.extend({
        limit: z.number().int().min(1).max(101).default(10),
        offset: z.number().int().min(0).default(0),
      }),
    )
    .query(({ ctx, input }) => ctx.logs.rows(input.serverIds, input)),
  count: logProcedure
    .input(filtersSchema)
    .query(({ ctx, input }) => ctx.logs.count(input.serverIds, input)),
  queriesOverTime: logProcedure
    .input(
      rangeSchema.extend({
        domain: z.string().optional(),
        client: z.string().optional(),
      }),
    )
    .query(({ ctx, input }) => {
      const { serverIds, ...options } = input;
      return ctx.logs.queriesOverTime(serverIds, options);
    }),
  topList: logProcedure
    .input(
      rangeSchema.extend({
        type: z.enum(["domains", "clients"]),
        filter: z.enum(["all", "blocked"]).default("all"),
        limit: z.number().int().min(1).max(100).default(10),
        offset: z.number().int().min(0).default(0),
      }),
    )
    .query(({ ctx, input }) => ctx.logs.topList(input.serverIds, input)),
  search: logProcedure
    .input(
      rangeSchema.extend({
        type: z.enum(["domains", "clients"]),
        query: z.string().min(1),
        limit: z.number().int().min(1).max(50).default(10),
      }),
    )
    .query(({ ctx, input }) => ctx.logs.search(input.serverIds, input)),
  queryTypes: logProcedure
    .input(rangeSchema)
    .query(({ ctx, input }) =>
      ctx.logs.queryTypes(input.serverIds, input.range),
    ),
});
