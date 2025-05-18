"use client";

import { Button } from "~/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { api } from "~/trpc/react";
import { useToast } from "~/components/ui/use-toast";

export function ListControls() {
  const { toast } = useToast();

  const refreshMutation = api.blocky.listsRefresh.useMutation({
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Lists have been refreshed",
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
        <CardTitle>List Controls</CardTitle>
      </CardHeader>
      <CardContent>
        <Button
          onClick={() => refreshMutation.mutate()}
          disabled={refreshMutation.isPending}
        >
          Refresh Lists
        </Button>
      </CardContent>
    </Card>
  );
}
