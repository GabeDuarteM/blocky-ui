"use client";

import { type ReactNode, useEffect } from "react";
import { Database, Power, Pause } from "lucide-react";
import { ActionLayout } from "~/components/dashboard/action-layout";
import { useDashboardServers } from "~/components/dashboard/server-context";
import { useServerCommand } from "~/hooks/use-server-command";
import { useCountdown } from "~/hooks/use-countdown";
import { Button } from "~/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import { Skeleton } from "~/components/ui/skeleton";
import { Badge } from "~/components/ui/badge";
import { api } from "~/trpc/react";
import { cn } from "~/lib/utils";

const DURATION_PRESETS = [
  { label: "5 minutes", value: "5m", icon: Pause },
  { label: "15 minutes", value: "15m", icon: Pause },
  { label: "30 minutes", value: "30m", icon: Pause },
  { label: "Disable", value: "0", icon: Power },
];

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
      void utils.servers.blockingStatus.invalidate();
    }
  }, [countdown, utils]);

  const showDisable = enabled > 0 || unavailable > 0;

  return (
    <Card className="min-h-52">
      <CardHeader>
        <CardTitle className="flex flex-wrap items-center justify-between gap-2">
          <span className="flex items-center gap-2">
            <Database className="h-5 w-5" />
            Blocking Status
          </span>
          {dashboard.loading ? (
            <Skeleton className="h-5 w-16" />
          ) : (
            <Badge
              variant="outline"
              className={cn(
                mixed || unavailable > 0
                  ? "border-amber-400 bg-amber-400/10 text-amber-400"
                  : enabled > 0
                    ? "border-green-400 bg-green-400/10 text-green-600"
                    : "border-red-400 bg-red-400/10 text-red-400",
              )}
            >
              {mixed
                ? "Mixed"
                : unavailable > 0
                  ? "Unknown"
                  : enabled > 0
                    ? "Enabled"
                    : "Disabled"}
            </Badge>
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
              aria-label="Loading blocking status"
            >
              {DURATION_PRESETS.map((preset) => (
                <Skeleton key={preset.value} className="h-9 w-full" />
              ))}
            </div>
          ) : (
            <div className="space-y-4">
              {disabled > 0 && countdown !== null && countdown > 0 && (
                <p className="text-muted-foreground text-sm tabular-nums">
                  Auto-enables in {Math.floor(countdown / 60)}m{" "}
                  {(countdown % 60).toString().padStart(2, "0")}s
                </p>
              )}
              {(disabled > 0 || unavailable > 0) && (
                <Button
                  className="flex w-full items-center gap-2"
                  disabled={command.isPending}
                  onClick={() => void command.execute({ action: "enable" })}
                >
                  {!showDisable && <Power className="size-4" />}
                  {targets.length > 1 ? "Enable on selected servers" : "Enable"}
                </Button>
              )}
              {showDisable && (
                <div className="grid grid-cols-2 gap-2">
                  {DURATION_PRESETS.map((preset) => {
                    const Icon = preset.icon;
                    return (
                      <Button
                        key={preset.value}
                        variant={
                          preset.value === "0" ? "destructive" : "outline"
                        }
                        disabled={command.isPending}
                        className="flex items-center gap-2"
                        onClick={() =>
                          void command.execute({
                            action: "disable",
                            duration: preset.value,
                          })
                        }
                      >
                        <Icon className="size-4" />
                        {preset.label}
                      </Button>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </ActionLayout>
      </CardContent>
    </Card>
  );
}
