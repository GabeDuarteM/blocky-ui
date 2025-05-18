"use client";

import { Button } from "~/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { toast } from "sonner";
import { api } from "~/trpc/react";

export function ListControls() {
  const utils = api.useUtils();

  const refreshMutation = api.blocky.listsRefresh.useMutation({
    onSuccess: () => {
      toast.success("Lists have been refreshed");
    },
    onError: (error) => {
      toast.error("Failed to refresh lists", {
        description: error.message,
      });
    },
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>List Controls</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="flex gap-2">
            <Button
              onClick={() => refreshMutation.mutate()}
              disabled={refreshMutation.isPending}
            >
              Refresh Lists
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
