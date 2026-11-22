import { initTRPC } from "@trpc/server";
import superjson from "superjson";
import { ZodError, z } from "zod";
import type { DemoService } from "~/demo/config";
import {
  DEFAULT_DEMO_CONFIGURATION,
  getDemoConfigurationFromHeaders,
} from "~/demo/config";
import { createBlockyServers } from "~/server/blocky/servers";
import { getConfiguration } from "~/server/config";
import { getDemoScenario } from "~/server/demo";
import { getLogCoordinator } from "~/server/logs";

export const createTRPCContext = async (opts: { headers: Headers }) => {
  const configured = await getConfiguration();
  const demoConfiguration = configured.demoMode
    ? getDemoConfigurationFromHeaders(opts.headers)
    : DEFAULT_DEMO_CONFIGURATION;
  const isDemoServiceAvailable = (service: DemoService) =>
    demoConfiguration.services[service];
  const scenario = configured.demoMode
    ? getDemoScenario(demoConfiguration.serverCount)
    : undefined;
  const configuration = scenario?.configuration ?? configured;

  return {
    configuration,
    logs: scenario?.logs ?? (await getLogCoordinator()),
    servers: createBlockyServers(configuration),
    isDemoServiceAvailable,
    ...opts,
  };
};

/**
 * This is where the tRPC API is initialized, connecting the context and transformer. We also parse
 * ZodErrors so that you get typesafety on the frontend if your procedure fails due to validation
 * errors on the backend.
 */
const t = initTRPC.context<typeof createTRPCContext>().create({
  transformer: superjson,
  errorFormatter({ shape, error }) {
    return {
      ...shape,
      data: {
        ...shape.data,
        zodError:
          error.cause instanceof ZodError ? z.treeifyError(error.cause) : null,
      },
    };
  },
});

/**
 * Create a server-side caller.
 *
 * @see https://trpc.io/docs/server/server-side-calls
 */
export const { createCallerFactory } = t;

export const createTRPCRouter = t.router;

/**
 * Middleware for timing procedure execution and adding an artificial delay in development.
 *
 * You can remove this if you don't like it, but it can help catch unwanted waterfalls by simulating
 * network latency that would occur in production but not in local development.
 */
const timingMiddleware = t.middleware(async ({ next, path }) => {
  if (!t._config.isDev) {
    return next();
  }

  const start = Date.now();
  const waitMs = Math.floor(Math.random() * 400) + 100;
  await new Promise((resolve) => setTimeout(resolve, waitMs));

  const result = await next();

  const end = Date.now();
  console.log(`[TRPC] ${path} took ${end - start}ms to execute`);

  return result;
});

export const publicProcedure = t.procedure.use(timingMiddleware);
