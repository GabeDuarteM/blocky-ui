"use client";

import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { useEffect, useState } from "react";
import { api } from "~/trpc/react";

interface BlockingStatus {
  enabled: boolean;
  disabledGroups: string[];
  autoEnableInSec: number | null;
}

export function BlockingStatus() {
  const { data: status, isLoading } = api.blocky.blockingStatus.useQuery();
  const [countdown, setCountdown] = useState<number | null>(null);

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
          <CardTitle>Blocking Status</CardTitle>
        </CardHeader>
        <CardContent>Loading...</CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Blocking Status</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <div
              className={`h-3 w-3 rounded-full ${
                status?.enabled ? "bg-green-500" : "bg-red-500"
              }`}
            />
            <span>Blocking is {status?.enabled ? "enabled" : "disabled"}</span>
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
        </div>
      </CardContent>
    </Card>
  );
}
