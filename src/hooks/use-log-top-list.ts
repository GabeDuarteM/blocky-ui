"use client";

import { useQuery } from "@tanstack/react-query";
import { useSelectedServers } from "~/components/dashboard/server-context";
import { useLogDiagnostics } from "~/hooks/use-log-diagnostics";
import { keepDataWhenOnlyChanged } from "~/lib/keep-previous-data";
import type { RouterInputs } from "~/trpc/react";
import { useTRPC } from "~/trpc/react";

export function useLogTopList(
  options: Omit<RouterInputs["logs"]["topList"], "serverIds">,
  enabled = true,
) {
  const trpc = useTRPC();
  const serverIds = useSelectedServers("view");
  const input = { ...options, serverIds };
  const connected = useQuery(
    trpc.logs.topList.queryOptions(input, {
      enabled,
      placeholderData: keepDataWhenOnlyChanged(input, ["offset", "limit"]),
    }),
  );
  useLogDiagnostics(
    `top-${options.type}`,
    enabled ? connected.data?.diagnostics : undefined,
  );
  return connected;
}
