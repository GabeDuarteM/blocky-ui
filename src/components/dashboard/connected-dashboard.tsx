"use client";

import { useCallback, useMemo, useState } from "react";
import { Dashboard } from "~/components/dashboard/dashboard";
import { ServerContext } from "~/components/dashboard/server-context";
import {
  ActionTargets,
  ServerSelector,
} from "~/components/dashboard/server-selector";
import { demoServers } from "~/demo/config";
import { useDemoConfiguration } from "~/demo/context";
import { useServerSelection } from "~/hooks/use-server-selection";
import { api, type RouterOutputs } from "~/trpc/react";

export function ConnectedDashboard({
  servers: initialServers,
  demoMode = false,
}: {
  servers: RouterOutputs["servers"]["list"];
  demoMode?: boolean;
}) {
  const demo = useDemoConfiguration();
  const { data: configuredServers } = api.servers.list.useQuery(undefined, {
    initialData: initialServers,
    enabled: !demoMode,
    refetchInterval: 30_000,
  });
  const servers = demoMode ? demoServers(demo.serverCount) : configuredServers;
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
  const toggles = useMemo(() => {
    const toggle =
      (scope: Parameters<typeof selection.toggle>[0]) => (id: string) =>
        selection.toggle(scope, id);
    return {
      blocking: toggle("blocking"),
      maintenance: toggle("maintenance"),
      query: toggle("query"),
      view: toggle("view"),
    };
  }, [selection]);
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
    const result = statuses?.find((entry) => entry.serverId === server.id);
    return {
      id: server.id,
      name: server.name,
      online: result?.success ?? (status.error ? false : undefined),
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
      return;
    }
    return (
      <ActionTargets
        actionLabel={scope === "query" ? "Run on" : "Apply to"}
        matchTriggerWidth={scope !== "query"}
        label={label}
        selected={selection.selected(scope)}
        servers={pickerServers}
        onToggle={toggles[scope]}
      />
    );
  }
  const unreachable = pickerServers.filter((server) => server.online === false);
  const unavailableStatistics =
    statistics.data
      ?.filter(
        (result) =>
          !(
            result.success ||
            unreachable.some((server) => server.id === result.serverId)
          ),
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
      {servers.length > 1 || hasDiagnostics ? (
        <div className="mb-6 space-y-3">
          {servers.length > 1 ? (
            <ServerSelector
              label="Showing"
              description="View statistics and logs by server"
              selected={selection.selected("view")}
              servers={pickerServers}
              onToggle={toggles.view}
            />
          ) : null}
          {hasDiagnostics ? (
            <div
              role="status"
              className="space-y-1 rounded-lg border bg-card px-4 py-3 text-sm"
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
              {Boolean(statistics.error) && (
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
          ) : null}
        </div>
      ) : null}
      <Dashboard
        showLogs={servers.some((server) => server.hasLogs)}
        showServerColumn={
          servers.length > 1 || servers.some((server) => server.hasMappedLogs)
        }
        blockingControls={controls("blocking", "Blocking targets")}
        maintenanceControls={controls("maintenance", "Operation targets")}
        queryControls={controls("query", "Query targets")}
      />
    </ServerContext>
  );
}
