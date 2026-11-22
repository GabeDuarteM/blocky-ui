import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import type { NextRequest } from "next/server";

import { env } from "~/env";
import { initMocks } from "~/mocks/init";
import { appRouter } from "~/server/api/root";
import { createTRPCContext } from "~/server/api/trpc";
import { getConfiguration } from "~/server/config";

let mocks: Promise<void> | undefined;

const createContext = async (req: NextRequest) =>
  createTRPCContext({
    headers: req.headers,
  });

async function handler(req: NextRequest) {
  const { demoMode } = await getConfiguration();

  if (demoMode) {
    mocks ??= initMocks();
    await mocks;
  }

  return fetchRequestHandler({
    endpoint: "/api/trpc",
    req,
    router: appRouter,
    createContext: () => createContext(req),
    onError({ path, error }) {
      if (
        env.NODE_ENV === "development" ||
        error.code === "INTERNAL_SERVER_ERROR"
      ) {
        console.error(
          `❌ tRPC failed on ${path ?? "<no-path>"}: ${error.message}`,
        );
      }
    },
  });
}

export { handler as GET, handler as POST };
