"use client";

import { Database, Pause, Power } from "lucide-react";
import { type ReactNode, useCallback, useEffect } from "react";
import { ActionLayout } from "~/components/dashboard/action-layout";
import { useDashboardServers } from "~/components/dashboard/server-context";
import { StatusBadge } from "~/components/dashboard/status-badge";
import { Button } from "~/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import { Skeleton } from "~/components/ui/skeleton";
import { useCountdown } from "~/hooks/use-countdown";
import { useServerCommand } from "~/hooks/use-server-command";
import { api } from "~/trpc/react";

const DURATION_PRESETS = [
  { label: "5 minutes", value: "5m", icon: Pause },
  { label: "15 minutes", value: "15m", icon: Pause },
  { label: "30 minutes", value: "30m", icon: Pause },
  { label: "Disable", value: "0", icon: Power },
];

function blockingStatus(mixed: boolean, unavailable: number, enabled: number) {
  if (mixed) {
    return { tone: "warning", label: "Mixed" } as const;
  }
  if (unavailable > 0) {
    return { tone: "warning", label: "Unknown" } as const;
  }
  if (enabled > 0) {
    return { tone: "success", label: "Enabled" } as const;
  }
  return { tone: "danger", label: "Disabled" } as const;
}
export function ServerStatus({ controls }: { controls?: ReactNode }) {
  const dashboard = useDashboardServers();
  const command = useServerCommand("blocking");
  const utils = api.useUtils();
  const targets = dashboard.selection.selected("blocking");
  const known =
    dashboard.statuses?.flatMap((result) =>
      targets.includes(result.serverId) && result.success ? [result.data] : [],
    ) ?? [];
  const enabled = known.filter((status) => status.enabled).length;
  const disabled = known.length - enabled;
  const unavailable = targets.length - known.length;
  const mixed = enabled > 0 && disabled > 0;
  const countdown = useCountdown(
    targets.length === 1 ? known[0]?.autoEnableInSec : undefined,
    dashboard.statusUpdatedAt,
  );
  useEffect(() => {
    if (countdown === 0) {
      utils.servers.blockingStatus.invalidate();
    }
  }, [countdown, utils]);

  const displayStatus = blockingStatus(mixed, unavailable, enabled);
  const showDisable = enabled > 0 || unavailable > 0;

  const enableBlocking = useCallback(
    () => command.execute({ action: "enable" }),
    [command],
  );
  return (
    <Card role="region" aria-label="Blocking Status" className="min-h-52">
      <CardHeader>
        <CardTitle className="flex flex-wrap items-center justify-between gap-2">
          <span className="flex items-center gap-2">
            <Database className="h-5 w-5" />
            Blocking Status
          </span>
          {dashboard.loading ? (
            <Skeleton className="h-5 w-16" />
          ) : (
            <StatusBadge tone={displayStatus.tone}>
              {displayStatus.label}
            </StatusBadge>
          )}
        </CardTitle>
        <CardDescription>
          Enable blocking or pause it temporarily
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ActionLayout controls={controls}>
          {dashboard.loading ? (
            <div
              className="grid grid-cols-2 gap-2"
              role="status"
              aria-label="Loading blocking status"
            >
              {DURATION_PRESETS.map((preset) => (
                <Skeleton key={preset.value} className="h-9 w-full" />
              ))}
            </div>
          ) : (
            <div className="space-y-4">
              {disabled > 0 && countdown !== null && countdown > 0 ? (
                <p className="text-muted-foreground text-sm tabular-nums">
                  Auto-enables in {Math.floor(countdown / 60)}m{" "}
                  {(countdown % 60).toString().padStart(2, "0")}s
                </p>
              ) : null}
              {disabled > 0 || unavailable > 0 ? (
                <Button
                  size="responsive"
                  className="flex w-full items-center gap-2"
                  disabled={command.isPending}
                  onClick={enableBlocking}
                >
                  {!showDisable && <Power className="size-4" />}
                  {targets.length > 1 ? "Enable on selected servers" : "Enable"}
                </Button>
              ) : null}
              {showDisable ? (
                <div className="grid grid-cols-2 gap-2">
                  {DURATION_PRESETS.map((preset) => (
                    <DisableButton
                      key={preset.value}
                      preset={preset}
                      execute={command.execute}
                      isPending={command.isPending}
                    />
                  ))}
                </div>
              ) : null}
            </div>
          )}
        </ActionLayout>
      </CardContent>
    </Card>
  );
}

function DisableButton({
  preset,
  execute,
  isPending,
}: {
  preset: (typeof DURATION_PRESETS)[number];
  execute: ReturnType<typeof useServerCommand>["execute"];
  isPending: boolean;
}) {
  const disable = useCallback(
    () => execute({ action: "disable", duration: preset.value }),
    [execute, preset.value],
  );
  const Icon = preset.icon;
  return (
    <Button
      size="responsive"
      variant={preset.value === "0" ? "destructive" : "outline"}
      disabled={isPending}
      className="flex items-center gap-2"
      onClick={disable}
    >
      <Icon className="size-4" />
      {preset.label}
    </Button>
  );
}
