"use client";

import { Button } from "~/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { toast } from "sonner";
import { api } from "~/trpc/react";

export function CacheControls() {
  const clearMutation = api.blocky.cacheClear.useMutation({
    onSuccess: () => {
      toast.success("Cache has been cleared");
    },
    onError: (error) => {
      toast.error("Failed to clear cache", {
        description: error.message,
      });
    },
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Cache Controls</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="flex gap-2">
            <Button
              onClick={() => clearMutation.mutate()}
              disabled={clearMutation.isPending}
              variant="destructive"
            >
              Clear Cache
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
