"use client";

import { Search } from "lucide-react";
import { Button } from "~/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import { Input } from "~/components/ui/input";
import { toast } from "sonner";
import { api } from "~/trpc/react";
import { useState } from "react";
import type { TRPCClientErrorLike } from "@trpc/client";
import type { AppRouter } from "~/server/api/root";

export function QueryTool() {
  const [query, setQuery] = useState("");
  const [type, setType] = useState("A");

  const queryMutation = api.blocky.queryExecute.useMutation({
    onError: (error: TRPCClientErrorLike<AppRouter>) => {
      toast.error("Query failed", {
        description: error.message,
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!query) return;

    queryMutation.mutate({
      query,
      type,
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Search className="h-5 w-5" />
          DNS Query Tool
        </CardTitle>
        <CardDescription>Test DNS resolution for a domain</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="flex gap-2">
            <Input
              placeholder="Enter domain (e.g., example.com)"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="flex-1"
            />
            <select
              value={type}
              onChange={(e) => setType(e.target.value)}
              className="border-input bg-background ring-offset-background focus-visible:ring-ring rounded-md border px-3 py-2 text-sm focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
            >
              <option value="A">A</option>
              <option value="AAAA">AAAA</option>
              <option value="CNAME">CNAME</option>
              <option value="MX">MX</option>
              <option value="TXT">TXT</option>
            </select>
            <Button type="submit" disabled={queryMutation.isPending}>
              Query
            </Button>
          </div>
        </form>

        {queryMutation.data && (
          <div className="mt-4 space-y-2 rounded-lg border p-4">
            <div>
              <span className="font-medium">Response Type:</span>{" "}
              {queryMutation.data.responseType}
            </div>
            <div>
              <span className="font-medium">Return Code:</span>{" "}
              {queryMutation.data.returnCode}
            </div>
            <div>
              <span className="font-medium">Reason:</span>{" "}
              {queryMutation.data.reason}
            </div>
            <div>
              <span className="font-medium">Response:</span>{" "}
              {queryMutation.data.response}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
