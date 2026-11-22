import { logsRouter } from "~/server/api/routers/logs";
import { serversRouter } from "~/server/api/routers/servers";
import { createTRPCRouter } from "~/server/api/trpc";

export const appRouter = createTRPCRouter({
  servers: serversRouter,
  logs: logsRouter,
});

export type AppRouter = typeof appRouter;
