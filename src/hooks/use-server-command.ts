"use client";

import { toast } from "sonner";
import { api, type RouterInputs } from "~/trpc/react";
import { useDashboardServers } from "~/components/dashboard/server-context";

type Command = RouterInputs["servers"]["command"]["command"];

export function useServerCommand(scope: "blocking" | "maintenance") {
  const dashboard = useDashboardServers();
  const utils = api.useUtils();
  const mutation = api.servers.command.useMutation();

  async function execute(command: Command, targets?: string[]) {
    const serverIds = targets ?? dashboard.selection.selected(scope);
    try {
      const results = await mutation.mutateAsync({ serverIds, command });
      const failed = results.filter((result) => !result.success);
      const succeeded = results.length - failed.length;
      const names = (ids: string[]) =>
        dashboard.servers
          .filter((server) => ids.includes(server.id))
          .map((server) => server.name)
          .join(", ");
      if (succeeded) {
        toast.success(
          `Completed on ${succeeded} ${succeeded === 1 ? "server" : "servers"}`,
        );
      }
      if (failed.length) {
        const uncertain = failed.some(
          (result) => !result.success && result.error.kind === "timeout",
        );
        toast.error(
          uncertain
            ? "Some servers did not confirm the action"
            : "Some actions failed",
          {
            description: [
              names(failed.map((result) => result.serverId)),
              command.action === "disable" && command.duration !== "0"
                ? "Retrying restarts the blocking timer on these servers."
                : undefined,
            ]
              .filter(Boolean)
              .join(". "),
            action: {
              label: "Retry",
              onClick: () =>
                void retry(
                  command,
                  failed.map((result) => result.serverId),
                ),
            },
          },
        );
      }
    } catch (error) {
      toast.error("Unable to complete the action", {
        description: error instanceof Error ? error.message : undefined,
      });
    } finally {
      await Promise.all([
        utils.servers.blockingStatus.invalidate(),
        utils.servers.statistics.invalidate(),
      ]);
    }
  }

  async function retry(command: Command, targets: string[]) {
    if (command.action === "enable" || command.action === "disable") {
      try {
        const statuses = await utils.servers.blockingStatus.fetch(
          { serverIds: targets },
          { staleTime: 0 },
        );
        const pending = statuses
          .filter((result) => {
            if (!result.success) {
              return true;
            }
            if (command.action === "enable") {
              return !result.data.enabled;
            }
            return (
              Boolean(command.groups) ||
              command.duration !== "0" ||
              result.data.enabled ||
              Boolean(result.data.autoEnableInSec)
            );
          })
          .map((result) => result.serverId);
        if (!pending.length) {
          toast.success("Blocking already matches on those servers");
          return;
        }
        await execute(command, pending);
        return;
      } catch {
        toast.error("Unable to check blocking status before retrying");
        return;
      }
    }
    await execute(command, targets);
  }

  return {
    execute,
    isPending: mutation.isPending,
  };
}
