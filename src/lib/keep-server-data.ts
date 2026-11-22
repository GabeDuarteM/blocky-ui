import type { TRPCQueryKey } from "@trpc/tanstack-react-query";

function serverScope(queryKey: TRPCQueryKey) {
  const input = queryKey[1]?.input;

  return typeof input === "object" &&
    input !== null &&
    "serverIds" in input &&
    Array.isArray(input.serverIds)
    ? input.serverIds.join(",")
    : null;
}

export function keepDataForServers(serverIds: string[]) {
  const scope = serverIds.join(",");

  return <TData>(
    previous: TData | undefined,
    previousQuery: { queryKey: TRPCQueryKey } | undefined,
  ) =>
    previousQuery && serverScope(previousQuery.queryKey) === scope
      ? previous
      : undefined;
}
