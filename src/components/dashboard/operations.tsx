"use client";

import { Activity, Shield, XCircle } from "lucide-react";
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

export function Operations() {
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

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Activity className="h-5 w-5" />
          Operations
        </CardTitle>
        <CardDescription>
          Perform maintenance operations on the DNS server
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        <Button
          variant="outline"
          className="flex w-full items-center gap-2"
          onClick={() => clearCacheMutation.mutate()}
          disabled={clearCacheMutation.isPending}
        >
          <XCircle className="h-4 w-4" />
          Clear DNS Cache
        </Button>
        <Button
          variant="outline"
          className="flex w-full items-center gap-2"
          onClick={() => refreshListsMutation.mutate()}
          disabled={refreshListsMutation.isPending}
        >
          <Shield className="h-4 w-4" />
          Reload Allow/Denylists
        </Button>
      </CardContent>
    </Card>
  );
}
