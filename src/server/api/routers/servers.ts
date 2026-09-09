import {
  readBlockyStatistics,
  createStatisticsSnapshot,
} from "~/server/blocky/statistics";
import { z } from "zod";
import { createTRPCRouter, publicProcedure } from "~/server/api/trpc";
import { blockyApiProcedure } from "~/server/api/demo";
import {
  commandSchema,
  executeCommand,
  readBlockingStatus,
} from "~/server/blocky/commands";
import { parseBlockyQueryResult } from "~/server/blocky/query";
import { BLOCKY_DNS_RECORD_TYPES } from "~/lib/constants";

const targetsSchema = z.object({ serverIds: z.array(z.string()).min(1) });

export const serversRouter = createTRPCRouter({
  list: publicProcedure.query(({ ctx }) => ctx.servers.list()),
  statistics: publicProcedure.input(targetsSchema).query(({ ctx, input }) =>
    ctx.isDemoServiceAvailable("statistics")
      ? ctx.servers.run(input.serverIds, async (client) => {
          const statistics = await readBlockyStatistics(client);
          return {
            ...createStatisticsSnapshot(statistics),
            summary: statistics.summary,
            answered: Object.values(statistics.byResponseType).reduce(
              (total, count) => total + count,
              0,
            ),
          };
        })
      : [],
  ),
  blockingStatus: blockyApiProcedure
    .input(targetsSchema)
    .query(({ ctx, input }) =>
      ctx.servers.run(input.serverIds, readBlockingStatus),
    ),
  command: blockyApiProcedure
    .input(targetsSchema.extend({ command: commandSchema }))
    .mutation(({ ctx, input }) =>
      ctx.servers.run(input.serverIds, (client) =>
        executeCommand(client, input.command),
      ),
    ),
  query: blockyApiProcedure
    .input(
      targetsSchema.extend({
        query: z.string().min(1),
        type: z.enum(BLOCKY_DNS_RECORD_TYPES),
      }),
    )
    .mutation(({ ctx, input }) =>
      ctx.servers.run(input.serverIds, async (client) =>
        parseBlockyQueryResult(
          await client
            .post("api/query", {
              json: { query: input.query, type: input.type },
            })
            .json(),
        ),
      ),
    ),
});
