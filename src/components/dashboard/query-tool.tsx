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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { toast } from "sonner";
import { api } from "~/trpc/react";
import { useState } from "react";
import type { TRPCClientErrorLike } from "@trpc/client";
import type { AppRouter } from "~/server/api/root";
import { DNS_RECORD_TYPES } from "~/lib/constants";

export function QueryTool() {
  const [query, setQuery] = useState("");
  const [type, setType] = useState<(typeof DNS_RECORD_TYPES)[number]>(
    DNS_RECORD_TYPES[0],
  );

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
          Query Tool
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
            <Select
              value={type}
              onValueChange={(value: (typeof DNS_RECORD_TYPES)[number]) =>
                setType(value)
              }
            >
              <SelectTrigger className="w-26">
                <SelectValue placeholder="Type" />
              </SelectTrigger>
              <SelectContent>
                {DNS_RECORD_TYPES.map((recordType) => (
                  <SelectItem key={recordType} value={recordType}>
                    {recordType}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
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
