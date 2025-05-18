"use client";

import { Button } from "~/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { toast } from "sonner";
import { api } from "~/trpc/react";
import { useEffect, useState } from "react";

const DURATION_PRESETS = [
  { label: "5 minutes", value: "5m" },
  { label: "15 minutes", value: "15m" },
  { label: "30 minutes", value: "30m" },
  { label: "Permanent", value: "0" },
];

export function BlockingStatus() {
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

  const clearCacheMutation = api.blocky.cacheClear.useMutation({
    onSuccess: () => {
      toast.success("Cache has been cleared");
    },
    onError: (error) => {
      toast.error("Failed to clear cache", {
        description: error.message,
      });
    },
  });

  const refreshListsMutation = api.blocky.listsRefresh.useMutation({
    onSuccess: () => {
      toast.success("Lists have been refreshed");
    },
    onError: (error) => {
      toast.error("Failed to refresh lists", {
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
    return `${minutes}:${remainingSeconds.toString().padStart(2, "0")}`;
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>DNS Controls</CardTitle>
        </CardHeader>
        <CardContent>Loading...</CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>DNS Controls</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <div
                className={`h-3 w-3 rounded-full ${
                  status?.enabled ? "bg-green-500" : "bg-red-500"
                }`}
              />
              <span>
                Blocking is {status?.enabled ? "enabled" : "disabled"}
              </span>
            </div>

            {countdown !== null && (
              <div className="text-muted-foreground text-sm">
                Will be enabled in {formatTime(countdown)}
              </div>
            )}

            {status?.disabledGroups && status.disabledGroups.length > 0 && (
              <div className="text-muted-foreground text-sm">
                Disabled groups: {status.disabledGroups.join(", ")}
              </div>
            )}

            {status?.enabled ? (
              <div className="flex flex-wrap gap-2">
                <Button
                  key="0"
                  variant="default"
                  onClick={() => disableMutation.mutate({ duration: "0" })}
                  disabled={disableMutation.isPending}
                >
                  Disable
                </Button>
                {DURATION_PRESETS.filter((preset) => preset.value !== "0").map(
                  (preset) => (
                    <Button
                      key={preset.value}
                      variant="outline"
                      onClick={() =>
                        disableMutation.mutate({ duration: preset.value })
                      }
                      disabled={disableMutation.isPending}
                    >
                      {`Disable for ${preset.label}`}
                    </Button>
                  ),
                )}
              </div>
            ) : (
              <Button
                onClick={() => enableMutation.mutate()}
                disabled={enableMutation.isPending}
              >
                Enable
              </Button>
            )}
          </div>

          <div className="text-muted-foreground mb-2 text-sm font-semibold">
            Advanced
          </div>
          <div className="flex gap-4">
            <Button
              onClick={() => clearCacheMutation.mutate()}
              disabled={clearCacheMutation.isPending}
              variant="destructive"
            >
              Clear Cache
            </Button>
            <Button
              onClick={() => refreshListsMutation.mutate()}
              disabled={refreshListsMutation.isPending}
            >
              Refresh Lists
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
