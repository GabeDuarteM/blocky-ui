"use client";

import { useLogDiagnostics } from "~/hooks/use-log-diagnostics";
import { api, type RouterInputs } from "~/trpc/react";
import { useDashboardServers } from "~/components/dashboard/server-context";

export function useLogTopList(
  options: Omit<RouterInputs["logs"]["topList"], "serverIds">,
  enabled = true,
) {
  const dashboard = useDashboardServers();
  const serverIds = dashboard.selection.selected("view");
  const connected = api.logs.topList.useQuery(
    { ...options, serverIds },
    { enabled },
  );
  useLogDiagnostics(
    `top-${options.type}`,
    enabled ? connected.data?.diagnostics : undefined,
  );
  return connected;
}
