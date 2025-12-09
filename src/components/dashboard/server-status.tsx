"use client";

import { Database, Loader2, Power, AlertCircle, Pause } from "lucide-react";
import { Button } from "~/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import { Badge } from "~/components/ui/badge";
import { toast } from "sonner";
import { api } from "~/trpc/react";
import { startTransition, useEffect, useState } from "react";
import { cn } from "~/lib/utils";

const DURATION_PRESETS = [
  { label: "5 minutes", value: "5m", icon: Pause },
  { label: "15 minutes", value: "15m", icon: Pause },
  { label: "30 minutes", value: "30m", icon: Pause },
  { label: "Disable", value: "0", icon: Power },
];

export function ServerStatus() {
  const utils = api.useUtils();
  const {
    data: status,
    isLoading,
    isFetching,
    error,
  } = api.blocky.blockingStatus.useQuery();
  const [countdown, setCountdown] = useState<number | null>(null);

  useEffect(() => {
    startTransition(() => {
      setCountdown(status?.autoEnableInSec ?? null);
    });
  }, [status?.autoEnableInSec]);

  const enableMutation = api.blocky.blockingEnable.useMutation({
    onSuccess: () => {
      toast.success("Blocking has been enabled");
      void utils.blocky.blockingStatus.invalidate();
    },
    onError: (error) => {
      toast.error("Failed to enable blocking", {
        description: error.message,
      });
    },
  });

  const disableMutation = api.blocky.blockingDisable.useMutation({
    onSuccess: () => {
      toast.success("Blocking has been disabled");
      void utils.blocky.blockingStatus.invalidate();
    },
    onError: (error) => {
      toast.error("Failed to disable blocking", {
        description: error.message,
      });
    },
  });

  useEffect(() => {
    if (countdown === null) return undefined;

    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev === null || prev <= 0) {
          clearInterval(timer);
          return null;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [countdown]);

  useEffect(() => {
    if (error) {
      toast.error("Failed to query blocking status", {
        description: error.message,
      });
    }
  }, [error]);

  const formatTime = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}m ${remainingSeconds.toString().padStart(2, "0")}s`;
  };

  let description = "";

  if (error) {
    description = "";
  } else if (status?.enabled) {
    description = "DNS server is currently running and processing queries.";
  } else if (countdown) {
    description = `DNS server is temporarily disabled. Auto-enables in ${formatTime(countdown)}.`;
  } else if (!isLoading) {
    description = "DNS server is permanently disabled until manually enabled.";
  }

  let content = null;

  if (error) {
    content = (
      <div className="flex h-full flex-col items-center justify-center gap-2 text-center text-red-400">
        <AlertCircle className="h-8 w-8" />
        <p className="text-sm">{error.message}</p>
      </div>
    );
  } else if (status?.enabled) {
    content = (
      <div className="space-y-4">
        <div>
          <div className="grid grid-cols-2 gap-2">
            {DURATION_PRESETS.map((preset) => {
              const Icon = preset.icon;
              return (
                <Button
                  key={preset.value}
                  variant={preset.value === "0" ? "destructive" : "outline"}
                  onClick={() =>
                    disableMutation.mutate({ duration: preset.value })
                  }
                  disabled={isFetching || disableMutation.isPending}
                  className="flex items-center gap-2"
                >
                  <Icon className="h-4 w-4" />
                  {preset.label}
                </Button>
              );
            })}
          </div>
        </div>
      </div>
    );
  } else if (!isLoading) {
    content = (
      <Button
        className="flex w-full items-center gap-2"
        onClick={() => enableMutation.mutate()}
        disabled={isFetching || enableMutation.isPending}
      >
        <Power className="h-4 w-4" />
        Enable
      </Button>
    );
  } else {
    content = (
      <div className="flex justify-center">
        <Loader2 className="h-10 w-10 animate-spin" />
      </div>
    );
  }

  return (
    <Card className="min-h-52">
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span className="flex items-center gap-2">
            <Database className="h-5 w-5" />
            Server Status
          </span>
          <Badge
            variant="outline"
            className={cn(
              (isLoading || error) && "invisible",
              status?.enabled
                ? "border-green-400 bg-green-400/10 text-green-600"
                : "border-red-400 bg-red-400/10 text-red-400",
            )}
          >
            {status?.enabled ? "Enabled" : "Disabled"}
          </Badge>
        </CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="h-full">{content}</CardContent>
    </Card>
  );
}
