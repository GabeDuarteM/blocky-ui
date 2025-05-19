"use client";

import { Clock, Database, Power } from "lucide-react";
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

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="h-5 w-5" />
            Server Status
          </CardTitle>
        </CardHeader>
        <CardContent>Loading...</CardContent>
      </Card>
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
            className={`rounded-full px-3 py-1 text-sm font-medium ${
              status?.enabled
                ? "bg-green-100 text-green-800"
                : "bg-red-100 text-red-800"
            }`}
          >
            {status?.enabled ? "Enabled" : "Disabled"}
          </div>
        </CardTitle>
        <CardDescription>
          {status?.enabled
            ? "DNS server is currently running and processing queries."
            : countdown
              ? `DNS server is temporarily disabled. Auto-enables in ${formatTime(countdown)}.`
              : "DNS server is permanently disabled until manually enabled."}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {status?.enabled ? (
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
        ) : (
          <Button
            className="flex w-full items-center gap-2"
            onClick={() => enableMutation.mutate()}
            disabled={enableMutation.isPending}
          >
            <Power className="h-4 w-4" />
            Enable
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
