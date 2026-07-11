import { TRPCError } from "@trpc/server";
import { env } from "~/env";
import { publicProcedure } from "~/server/api/trpc";

export const BLOCKY_API_UNAVAILABLE_MESSAGE = `Unable to reach Blocky API at ${env.BLOCKY_API_URL}. Please check if the API server is running.`;

export const blockyApiProcedure = publicProcedure.use(async ({ ctx, next }) => {
  if (!ctx.isDemoServiceAvailable("blockyApi")) {
    throw new TRPCError({
      code: "SERVICE_UNAVAILABLE",
      message: BLOCKY_API_UNAVAILABLE_MESSAGE,
    });
  }

  return next();
});
