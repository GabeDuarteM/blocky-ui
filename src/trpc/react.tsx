"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import {
  createTRPCClient,
  httpBatchStreamLink,
  loggerLink,
} from "@trpc/client";
import type { inferRouterInputs, inferRouterOutputs } from "@trpc/server";
import { createTRPCContext } from "@trpc/tanstack-react-query";
import { useMemo } from "react";
import SuperJSON from "superjson";
import type { DemoServerCount } from "~/demo/config";
import {
  DEMO_CONFIGURATION_HEADER,
  DEMO_SERVER_COUNT_HEADER,
} from "~/demo/config";
import type { AppRouter } from "./app-router";

const createQueryClient = () =>
  new QueryClient({ defaultOptions: { queries: { staleTime: 30 * 1000 } } });

let clientQueryClientSingleton: QueryClient | undefined;
const getQueryClient = () => {
  if (typeof window === "undefined") {
    // Server: always make a new query client
    return createQueryClient();
  }
  // Browser: use singleton pattern to keep the same query client
  clientQueryClientSingleton ??= createQueryClient();

  return clientQueryClientSingleton;
};

const { TRPCProvider, useTRPC } = createTRPCContext<AppRouter>();

export { useTRPC };

export type RouterInputs = inferRouterInputs<AppRouter>;

export type RouterOutputs = inferRouterOutputs<AppRouter>;

export function TRPCReactProvider({
  children,
  demoConfiguration,
  demoServerCount,
}: {
  children: React.ReactNode;
  demoConfiguration?: string;
  demoServerCount?: DemoServerCount;
}) {
  const queryClient = getQueryClient();

  const trpcClient = useMemo(
    () =>
      createTRPCClient<AppRouter>({
        links: [
          loggerLink({
            enabled: (op) =>
              process.env.NODE_ENV === "development" ||
              (op.direction === "down" && op.result instanceof Error),
          }),
          httpBatchStreamLink({
            transformer: SuperJSON,
            url: `${getBaseUrl()}/api/trpc`,
            headers: () => {
              const headers = new Headers();
              if (demoConfiguration) {
                headers.set(DEMO_CONFIGURATION_HEADER, demoConfiguration);
              }
              if (demoServerCount !== undefined) {
                headers.set(DEMO_SERVER_COUNT_HEADER, String(demoServerCount));
              }
              return headers;
            },
          }),
        ],
      }),
    [demoConfiguration, demoServerCount],
  );

  return (
    <QueryClientProvider client={queryClient}>
      <TRPCProvider trpcClient={trpcClient} queryClient={queryClient}>
        {children}
      </TRPCProvider>
      <ReactQueryDevtools initialIsOpen={false} />
    </QueryClientProvider>
  );
}

function getBaseUrl() {
  if (typeof window !== "undefined") {
    return window.location.origin;
  }
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`;
  }
  return `http://localhost:${process.env.PORT ?? 3000}`;
}
