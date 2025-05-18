"use client";

import { Button } from "~/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { useToast } from "~/components/ui/use-toast";
import { api } from "~/trpc/react";

const DURATION_PRESETS = [
  { label: "5 minutes", value: "5m" },
  { label: "10 minutes", value: "10m" },
  { label: "15 minutes", value: "15m" },
  { label: "30 minutes", value: "30m" },
  { label: "Permanent", value: "0" },
];

export function BlockingControls() {
  const { toast } = useToast();
  const utils = api.useUtils();

  const enableMutation = api.blocky.blockingEnable.useMutation({
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Blocking has been enabled",
      });
      void utils.blocky.blockingStatus.invalidate();
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const disableMutation = api.blocky.blockingDisable.useMutation({
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Blocking has been disabled",
      });
      void utils.blocky.blockingStatus.invalidate();
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Blocking Controls</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="flex gap-2">
            <Button
              onClick={() => enableMutation.mutate()}
              disabled={enableMutation.isPending}
            >
              Enable Blocking
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
