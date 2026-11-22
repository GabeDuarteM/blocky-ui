"use client";

import { useQuery } from "@tanstack/react-query";
import { useSelectedServers } from "~/components/dashboard/server-context";
import { useLogDiagnostics } from "~/hooks/use-log-diagnostics";
import { keepDataForServers } from "~/lib/keep-server-data";
import type { RouterInputs } from "~/trpc/react";
import { useTRPC } from "~/trpc/react";

export function useLogTopList(
  options: Omit<RouterInputs["logs"]["topList"], "serverIds">,
  enabled = true,
  keepPrevious = false,
) {
  const trpc = useTRPC();
  const serverIds = useSelectedServers("view");
  const connected = useQuery(
    trpc.logs.topList.queryOptions(
      { ...options, serverIds },
      {
        enabled,
        placeholderData: keepPrevious
          ? keepDataForServers(serverIds)
          : undefined,
      },
    ),
  );
  useLogDiagnostics(
    `top-${options.type}`,
    enabled ? connected.data?.diagnostics : undefined,
  );
  return connected;
}
