import { z } from "zod";
import { createTRPCRouter, publicProcedure } from "~/server/api/trpc";
import {
  BLOCKY_API_UNAVAILABLE_MESSAGE,
  blockyApiProcedure,
} from "~/server/api/demo";
import {
  BLOCKY_DNS_RECORD_TYPES,
  BLOCKY_RESPONSE_TYPES,
} from "~/lib/constants";
import { blockyApi } from "~/server/blocky/client";

const statusSchema = z.object({
  enabled: z.boolean(),
  disabledGroups: z.array(z.string()).optional(),
  autoEnableInSec: z.number().min(0).optional(),
});

const queryRequestSchema = z.object({
  query: z.string(),
  type: z.enum(BLOCKY_DNS_RECORD_TYPES),
});

const queryResultSchema = z.object({
  reason: z.string(),
  response: z.string(),
  responseType: z.string(),
  returnCode: z.string(),
});

export const blockyRouter = createTRPCRouter({
  blockingStatus: blockyApiProcedure.query(async () => {
    try {
      const response = await blockyApi.get("api/blocking/status");

      if (!response.ok) {
        throw new Error(
          `Failed to get blocking status: ${response.statusText}`,
        );
      }

      const data = await response.json();

      return statusSchema.parse(data);
    } catch (error) {
      if (error instanceof Error) {
        if (
          error.message.includes("Failed to fetch") ||
          error.message.includes("fetch failed") ||
          error.message.includes("NetworkError")
        ) {
          throw new Error(BLOCKY_API_UNAVAILABLE_MESSAGE);
        }

        throw error;
      }

      throw new Error(
        "An unexpected error occurred while fetching blocking status",
      );
    }
  }),
  blockingEnable: blockyApiProcedure.mutation(async () => {
    const response = await blockyApi.get("api/blocking/enable");
    if (!response.ok) {
      throw new Error(`Failed to enable blocking: ${response.statusText}`);
    }
    return { success: true };
  }),
  blockingDisable: blockyApiProcedure
    .input(
      z
        .object({
          duration: z.string().optional(),
          groups: z.string().optional(),
        })
        .optional(),
    )
    .mutation(async ({ input }) => {
      const searchParams = new URLSearchParams();

      if (input?.duration) searchParams.set("duration", input.duration);
      if (input?.groups) searchParams.set("groups", input.groups);

      const response = await blockyApi.get(
        `api/blocking/disable${searchParams.toString() ? `?${searchParams.toString()}` : ""}`,
      );

      if (!response.ok) {
        throw new Error(`Failed to disable blocking: ${response.statusText}`);
      }

      return { success: true };
    }),
  cacheClear: blockyApiProcedure.mutation(async () => {
    const response = await blockyApi.post("api/cache/flush");

    if (!response.ok) {
      throw new Error(`Failed to clear cache: ${response.statusText}`);
    }

    return { success: true };
  }),
  listsRefresh: blockyApiProcedure.mutation(async () => {
    const response = await blockyApi.post("api/lists/refresh");

    if (!response.ok) {
      throw new Error(`Failed to refresh lists: ${response.statusText}`);
    }

    return { success: true };
  }),
  queryExecute: blockyApiProcedure
    .input(queryRequestSchema)
    .mutation(async ({ input }) => {
      const response = await blockyApi.post("api/query", {
        json: input,
      });

      if (!response.ok) {
        throw new Error(`Failed to execute query: ${response.statusText}`);
      }

      const data = await response.json();

      return queryResultSchema.parse(data);
    }),
  getQueryLogs: publicProcedure
    .input(
      z
        .object({
          limit: z.number().min(1).max(100).default(50),
          offset: z.number().min(0).default(0),
          search: z.string().optional(),
          responseType: z.enum(BLOCKY_RESPONSE_TYPES).optional(),
          client: z.string().optional(),
          questionType: z.enum(BLOCKY_DNS_RECORD_TYPES).optional(),
        })
        .optional(),
    )
    .query(async ({ input, ctx }) => {
      if (!ctx.logProvider) {
        throw new Error("Log provider is not configured.");
      }

      return await ctx.logProvider.getQueryLogs({
        limit: input?.limit ?? 50,
        offset: input?.offset ?? 0,
        search: input?.search,
        responseType: input?.responseType,
        client: input?.client,
        questionType: input?.questionType,
      });
    }),
});
