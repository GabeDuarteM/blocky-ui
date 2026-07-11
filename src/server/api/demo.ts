import { env } from "~/env";
import { publicProcedure } from "~/server/api/trpc";

export const blockyApiProcedure = publicProcedure.use(async ({ ctx, next }) => {
  if (!ctx.isDemoServiceAvailable("blockyApi")) {
    throw new Error(
      `Unable to reach Blocky API at ${env.BLOCKY_API_URL}. Please check if the API server is running.`,
    );
  }

  return next();
});
