"use client";

import { useCallback, useState } from "react";
import { Dashboard } from "~/components/dashboard/dashboard";
import { ServerContext } from "~/components/dashboard/server-context";
import { ActionTargets } from "~/components/dashboard/server-selector";
import { useServerSelection } from "~/hooks/use-server-selection";
import { api, type RouterOutputs } from "~/trpc/react";

export function ConnectedDashboard({
  servers: initialServers,
}: {
  servers: RouterOutputs["servers"]["list"];
}) {
  const { data: configuredServers } = api.servers.list.useQuery(undefined, {
    initialData: initialServers,
    refetchInterval: 30_000,
  });
  const servers = configuredServers;
  const [logDiagnostics, setLogDiagnostics] = useState<
    Record<string, { sourceId: string; message: string }[]>
  >({});
  const reportDiagnostics = useCallback(
    (key: string, diagnostics: { sourceId: string; message: string }[]) => {
      setLogDiagnostics((previous) =>
        JSON.stringify(previous[key] ?? []) === JSON.stringify(diagnostics)
          ? previous
          : { ...previous, [key]: diagnostics },
      );
    },
    [],
  );
  const ids = servers.map((server) => server.id);
  const selection = useServerSelection(ids);
  const status = api.servers.blockingStatus.useQuery(
    { serverIds: ids },
    { refetchInterval: 30_000 },
  );
  const statistics = api.servers.statistics.useQuery(
    { serverIds: selection.selected("view") },
    { refetchInterval: 30_000 },
  );
  const statuses = status.isError ? undefined : status.data;
  const pickerServers = servers.map((server) => {
    const result = statuses?.find((result) => result.serverId === server.id);
    return {
      id: server.id,
      name: server.name,
      online: result ? result.success : status.error ? false : undefined,
      blocking: result?.success ? result.data.enabled : undefined,
      disabledGroups: result?.success ? result.data.disabledGroups : undefined,
      autoEnableInSec: result?.success
        ? result.data.autoEnableInSec
        : undefined,
      statusUpdatedAt: status.dataUpdatedAt,
    };
  });
  function controls(
    scope: "blocking" | "maintenance" | "query",
    label: string,
  ) {
    if (servers.length < 2) {
      return undefined;
    }
    return (
      <ActionTargets
        actionLabel={scope === "query" ? "Run on" : "Apply to"}
        matchTriggerWidth={scope !== "query"}
        label={label}
        selected={selection.selected(scope)}
        servers={pickerServers}
        onToggle={(id) => selection.toggle(scope, id)}
      />
    );
  }
  const unreachable = pickerServers.filter((server) => server.online === false);
  const unavailableStatistics =
    statistics.data
      ?.filter(
        (result) =>
          !result.success &&
          !unreachable.some((server) => server.id === result.serverId),
      )
      .map(
        (result) =>
          servers.find((server) => server.id === result.serverId)?.name ??
          result.serverId,
      ) ?? [];
  const failedSources = [
    ...new Set(
      Object.values(logDiagnostics)
        .flat()
        .map((diagnostic) => diagnostic.sourceId),
    ),
  ];
  const hasDiagnostics =
    unreachable.length > 0 ||
    unavailableStatistics.length > 0 ||
    failedSources.length > 0 ||
    Boolean(statistics.error);
  return (
    <ServerContext
      value={{
        servers,
        selection,
        statuses,
        loading: status.isLoading,
        statusUpdatedAt: status.dataUpdatedAt,
        statistics: statistics.data,
        statisticsLoading: statistics.isLoading,
        reportDiagnostics,
      }}
    >
      {hasDiagnostics && (
        <div className="mb-6 space-y-3">
          {hasDiagnostics && (
            <div
              role="status"
              className="bg-card space-y-1 rounded-lg border px-4 py-3 text-sm"
            >
              {unreachable.length > 0 && (
                <p className="text-amber-400">
                  Unreachable:{" "}
                  {unreachable.map((server) => server.name).join(", ")}
                </p>
              )}
              {unavailableStatistics.length > 0 && (
                <p className="text-amber-400">
                  Statistics unavailable: {unavailableStatistics.join(", ")}
                </p>
              )}
              {statistics.error && (
                <p className="text-amber-400">
                  Unable to load server statistics.
                </p>
              )}
              {failedSources.length > 0 && (
                <p className="text-amber-400">
                  Log queries failed: {failedSources.join(", ")}
                </p>
              )}
              <p className="text-muted-foreground text-xs">
                Showing available data. Stored logs do not require a live server
                connection.
              </p>
            </div>
          )}
        </div>
      )}
      <Dashboard
        showLogs={servers.some((server) => server.hasLogs)}
        blockingControls={controls("blocking", "Blocking targets")}
        maintenanceControls={controls("maintenance", "Operation targets")}
        queryControls={controls("query", "Query targets")}
      />
    </ServerContext>
  );
}
