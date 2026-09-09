"use client";

import { createContext, useContext } from "react";
import { type RouterOutputs } from "~/trpc/react";
import { type useServerSelection } from "~/hooks/use-server-selection";

export type DashboardServers = {
  servers: RouterOutputs["servers"]["list"];
  selection: ReturnType<typeof useServerSelection>;
  statuses: RouterOutputs["servers"]["blockingStatus"] | undefined;
  loading: boolean;
  statusUpdatedAt: number;
  statistics: RouterOutputs["servers"]["statistics"] | undefined;
  statisticsLoading: boolean;
  reportDiagnostics: (
    key: string,
    diagnostics: { sourceId: string; message: string }[],
  ) => void;
};

export const ServerContext = createContext<DashboardServers | null>(null);

export function useDashboardServers() {
  const context = useContext(ServerContext);
  if (!context) {
    throw new Error("Dashboard components require a server context.");
  }
  return context;
}
