"use client";

import { Button } from "~/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { toast } from "sonner";
import { api } from "~/trpc/react";

const DURATION_PRESETS = [
  { label: "5 minutes", value: "5m" },
  { label: "10 minutes", value: "10m" },
  { label: "15 minutes", value: "15m" },
  { label: "30 minutes", value: "30m" },
  { label: "Permanent", value: "0" },
];

export function BlockingControls() {
  const utils = api.useUtils();
  const status = api.blocky.blockingStatus.useQuery();
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

  if (!status.data) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Blocking Controls</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <div
              className={`h-2 w-2 rounded-full ${
                status.data.enabled ? "bg-green-500" : "bg-red-500"
              }`}
            />
            <span className="text-muted-foreground text-sm">
              {status.data.enabled ? "Blocking enabled" : "Blocking disabled"}
            </span>
          </div>
          <div className="flex gap-2">
            <Button
              onClick={() => enableMutation.mutate()}
              disabled={enableMutation.isPending}
            >
              Enable Blocking
            </Button>
            <Button
              onClick={() => disableMutation.mutate({})}
              disabled={disableMutation.isPending}
            >
              Disable Blocking
            </Button>
          </div>

          <div className="space-y-2">
            <div className="text-sm font-medium">Disable Blocking</div>
            <div className="flex flex-wrap gap-2">
              {DURATION_PRESETS.map((preset) => (
                <Button
                  key={preset.value}
                  variant="outline"
                  onClick={() =>
                    disableMutation.mutate({ duration: preset.value })
                  }
                  disabled={disableMutation.isPending}
                >
                  {preset.label}
                </Button>
              ))}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
