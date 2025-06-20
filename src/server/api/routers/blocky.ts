import { z } from "zod";
import { env } from "~/env";
import { createTRPCRouter, publicProcedure } from "~/server/api/trpc";
import ky from "ky";
import { BLOCKY_DNS_RECORD_TYPES } from "~/lib/constants";
import { logEntries } from "~/server/db/schema";
import { desc, sql, and, eq } from "drizzle-orm";

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

const api = ky.create({
  prefixUrl: env.BLOCKY_API_URL,
  headers: {
    "Content-Type": "application/json",
  },
});

export const blockyRouter = createTRPCRouter({
  blockingStatus: publicProcedure.query(async () => {
    try {
      const response = await api.get("api/blocking/status");

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
          throw new Error(
            `Unable to reach Blocky API at ${env.BLOCKY_API_URL}. Please check if the API server is running.`,
          );
        }

        throw error;
      }

      throw new Error(
        "An unexpected error occurred while fetching blocking status",
      );
    }
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
  getQueryLogs: publicProcedure
    .input(
      z
        .object({
          limit: z.number().min(1).max(100).default(50),
          offset: z.number().min(0).default(0),
          search: z.string().optional(),
          responseType: z.string().optional(),
        })
        .optional(),
    )
    .query(async ({ input, ctx }) => {
      const limit = input?.limit ?? 50;
      const offset = input?.offset ?? 0;
      const search = input?.search;
      const responseType = input?.responseType;

      if (env.DEMO_MODE) {
        const { default: logEntryMocks } = await import(
          "~/mocks/logEntryMocks.json"
        );

        let filteredLogs = logEntryMocks.sort((item1, item2) => {
          const date1 = new Date(item1.requestTs);
          const date2 = new Date(item2.requestTs);

          if (date1 > date2) return -1;
          if (date1 < date2) return 1;

          return 0;
        });

        if (search) {
          filteredLogs = filteredLogs.filter((log) =>
            log.questionName?.toLowerCase().includes(search.toLowerCase()),
          );
        }

        if (responseType) {
          filteredLogs = filteredLogs.filter(
            (log) => log.responseType === responseType,
          );
        }

        const totalCount = filteredLogs.length;

        const paginatedLogs = filteredLogs.slice(offset, offset + limit);

        return {
          items: paginatedLogs,
          totalCount,
        };
      }

      const filters = [];
      if (search) {
        filters.push(
          sql`LOWER(${logEntries.questionName}) LIKE LOWER(${`%${search}%`})`,
        );
      }
      if (responseType) {
        filters.push(eq(logEntries.responseType, responseType));
      }

      const countQuery = ctx.db
        .select({ count: sql<number>`count(*)` })
        .from(logEntries)
        .where(filters.length > 0 ? and(...filters) : undefined);

      const countResult = await countQuery;
      const count = countResult?.[0]?.count ?? 0;

      const query = ctx.db
        .select()
        .from(logEntries)
        .orderBy(desc(logEntries.requestTs))
        .limit(limit)
        .offset(offset)
        .where(filters.length > 0 ? and(...filters) : undefined);

      const logs = await query;

      return {
        items: logs,
        totalCount: Number(count),
      };
    }),
});
