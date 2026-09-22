import { TRPCError } from "@trpc/server";
import { publicProcedure } from "~/server/api/trpc";

const BLOCKY_API_UNAVAILABLE_MESSAGE = "Unable to reach the Blocky API.";

export const blockyApiProcedure = publicProcedure.use(({ ctx, next }) => {
  if (!ctx.isDemoServiceAvailable("blockyApi")) {
    return Promise.reject(
      new TRPCError({
        code: "SERVICE_UNAVAILABLE",
        message: BLOCKY_API_UNAVAILABLE_MESSAGE,
      }),
    );
  }

  return next();
});
