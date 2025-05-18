"use client";

import { Button } from "~/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { api } from "~/trpc/react";
import { useToast } from "~/components/ui/use-toast";

export function CacheControls() {
  const { toast } = useToast();

  const clearMutation = api.blocky.cacheClear.useMutation({
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Cache has been cleared",
      });
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
        <CardTitle>Cache Controls</CardTitle>
      </CardHeader>
      <CardContent>
        <Button
          onClick={() => clearMutation.mutate()}
          disabled={clearMutation.isPending}
          variant="destructive"
        >
          Clear Cache
        </Button>
      </CardContent>
    </Card>
  );
}
