"use client";

import { useId, useRef, useState } from "react";
import { toast } from "sonner";
import { useDashboardServers } from "~/components/dashboard/server-context";
import { api, type RouterInputs, type RouterOutputs } from "~/trpc/react";

type Query = RouterInputs["servers"]["query"];
type Results = RouterOutputs["servers"]["query"];

export function useServerQuery() {
  const dashboard = useDashboardServers();
  const mutation = api.servers.query.useMutation();
  const notificationId = useId();
  const generation = useRef(0);
  const pending = useRef(false);
  const [results, setResults] = useState<Results>([]);
  const [names, setNames] = useState<Record<string, string>>({});

  async function request(input: Query, current: number) {
    if (pending.current || current !== generation.current) {
      return;
    }

    pending.current = true;

    try {
      const next = await mutation.mutateAsync(input);

      setResults((previous) => {
        const updated = new Map(
          next.map((result) => [result.serverId, result]),
        );

        return previous.length
          ? previous.map((result) => updated.get(result.serverId) ?? result)
          : next;
      });

      const failed = next.filter((result) => !result.success);

      if (failed.length) {
        toast.error("Some DNS queries failed", {
          id: notificationId,
          description: `${input.query} (${input.type})`,
          action: {
            label: "Retry",
            onClick: () =>
              void request(
                {
                  ...input,
                  serverIds: failed.map((result) => result.serverId),
                },
                current,
              ),
          },
        });
      }
    } catch (error) {
      toast.error("Query failed", {
        id: notificationId,
        description: error instanceof Error ? error.message : undefined,
        action: {
          label: "Retry",
          onClick: () => void request(input, current),
        },
      });
    } finally {
      pending.current = false;
    }
  }

  function execute(input: Omit<Query, "serverIds">) {
    if (pending.current) {
      return;
    }

    generation.current++;
    toast.dismiss(notificationId);
    setResults([]);
    setNames(
      Object.fromEntries(
        dashboard.servers.map((server) => [server.id, server.name]),
      ),
    );

    void request(
      { ...input, serverIds: dashboard.selection.selected("query") },
      generation.current,
    );
  }

  return {
    execute,
    results,
    names,
    isPending: mutation.isPending,
    pendingServerIds: mutation.isPending
      ? (mutation.variables?.serverIds ?? [])
      : [],
  };
}
