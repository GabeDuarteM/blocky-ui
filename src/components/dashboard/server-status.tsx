"use client";

import { Clock, Database, Loader2, Power } from "lucide-react";
import { Button } from "~/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import { toast } from "sonner";
import { api } from "~/trpc/react";
import { useEffect, useState } from "react";
import clsx from "clsx";

const DURATION_PRESETS = [
  { label: "5 minutes", value: "5m", icon: Clock },
  { label: "15 minutes", value: "15m", icon: Clock },
  { label: "30 minutes", value: "30m", icon: Clock },
  { label: "Disable", value: "0", icon: Power },
];

export function ServerStatus() {
  const utils = api.useUtils();
  const { data: status, isLoading } = api.blocky.blockingStatus.useQuery();
  const [countdown, setCountdown] = useState<number | null>(null);

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
    if (!status?.autoEnableInSec) {
      setCountdown(null);
      return;
    }

    const initialCountdown = status.autoEnableInSec;
    setCountdown(initialCountdown);

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
  }, [status?.autoEnableInSec]);

  const formatTime = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}m ${remainingSeconds.toString().padStart(2, "0")}s`;
  };

  let description = "";

  if (status?.enabled) {
    description = "DNS server is currently running and processing queries.";
  } else if (countdown) {
    description = `DNS server is temporarily disabled. Auto-enables in ${formatTime(countdown)}.`;
  } else if (!isLoading) {
    description = "DNS server is permanently disabled until manually enabled.";
  }

  let content = null;

  if (status?.enabled) {
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
                  disabled={disableMutation.isPending}
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
        disabled={enableMutation.isPending}
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
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span className="flex items-center gap-2">
            <Database className="h-5 w-5" />
            Server Status
          </span>
          <div
            className={clsx(
              "rounded-full px-3 py-1 text-sm font-medium",
              status?.enabled
                ? "bg-green-100 text-green-800"
                : "bg-red-100 text-red-800",
              isLoading && "invisible",
            )}
          >
            {status?.enabled ? "Enabled" : "Disabled"}
          </div>
        </CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>{content}</CardContent>
    </Card>
  );
}
