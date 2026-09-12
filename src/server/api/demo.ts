import { TRPCError } from "@trpc/server";
import { publicProcedure } from "~/server/api/trpc";

const BLOCKY_API_UNAVAILABLE_MESSAGE = "Unable to reach the Blocky API.";

export const blockyApiProcedure = publicProcedure.use(async ({ ctx, next }) => {
  if (!ctx.isDemoServiceAvailable("blockyApi")) {
    throw new TRPCError({
      code: "SERVICE_UNAVAILABLE",
      message: BLOCKY_API_UNAVAILABLE_MESSAGE,
    });
  }

  return next();
});
