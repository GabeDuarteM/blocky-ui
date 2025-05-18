import { z } from "zod";
import { env } from "~/env";
import { createTRPCRouter, publicProcedure } from "~/server/api/trpc";
import ky from "ky";

const statusSchema = z.object({
  enabled: z.boolean(),
  disabledGroups: z.array(z.string()).optional(),
  autoEnableInSec: z.number().min(0).optional(),
});

const queryRequestSchema = z.object({
  query: z.string(),
  type: z.string(),
});

const queryResultSchema = z.object({
  reason: z.string(),
  response: z.string(),
  responseType: z.string(),
  returnCode: z.string(),
});

const api = ky.create({
  prefixUrl: env.BLOCKY_API_URL as string,
  headers: {
    "Content-Type": "application/json",
  },
});

export const blockyRouter = createTRPCRouter({
  blockingStatus: publicProcedure.query(async () => {
    const response = await api.get("api/blocking/status");
    if (!response.ok) {
      throw new Error(`Failed to get blocking status: ${response.statusText}`);
    }
    const data = await response.json();
    return statusSchema.parse(data);
  }),
  blockingEnable: publicProcedure.mutation(async () => {
    const response = await api.get("api/blocking/enable");
    if (!response.ok) {
      throw new Error(`Failed to enable blocking: ${response.statusText}`);
    }
    return { success: true };
  }),
  blockingDisable: publicProcedure
    .input(
      z.object({
        duration: z.string().optional(),
        groups: z.string().optional(),
      }),
    )
    .mutation(async ({ input }) => {
      const searchParams = new URLSearchParams();
      if (input.duration) searchParams.set("duration", input.duration);
      if (input.groups) searchParams.set("groups", input.groups);

      const response = await api.get(
        `api/blocking/disable${searchParams.toString() ? `?${searchParams.toString()}` : ""}`,
      );

      if (!response.ok) {
        throw new Error(`Failed to disable blocking: ${response.statusText}`);
      }

      return { success: true };
    }),
  cacheClear: publicProcedure.mutation(async () => {
    const response = await api.post("api/cache/flush");
    if (!response.ok) {
      throw new Error(`Failed to clear cache: ${response.statusText}`);
    }
    return { success: true };
  }),
  listsRefresh: publicProcedure.mutation(async () => {
    const response = await api.post("api/lists/refresh");
    if (!response.ok) {
      throw new Error(`Failed to refresh lists: ${response.statusText}`);
    }
    return { success: true };
  }),
  queryExecute: publicProcedure
    .input(queryRequestSchema)
    .mutation(async ({ input }) => {
      const response = await api.post("api/query", {
        json: input,
      });
      if (!response.ok) {
        throw new Error(`Failed to execute query: ${response.statusText}`);
      }
      const data = await response.json();
      return queryResultSchema.parse(data);
    }),
});
