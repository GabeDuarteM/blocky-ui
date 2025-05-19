"use client";

import { Search, Type, Code, AlertCircle, MessageSquare } from "lucide-react";
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
import { DNS_RECORD_TYPES } from "~/lib/constants";

type DNS_RECORD_TYPE = (typeof DNS_RECORD_TYPES)[number];

export function QueryTool() {
  const [query, setQuery] = useState("");
  const [type, setType] = useState<DNS_RECORD_TYPE>(DNS_RECORD_TYPES[0]);

  const queryMutation = api.blocky.queryExecute.useMutation({
    onError: (error) => {
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
              onValueChange={(value: DNS_RECORD_TYPE) => setType(value)}
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
            <Button
              type="submit"
              variant="outline"
              disabled={queryMutation.isPending}
              className="flex items-center gap-2"
            >
              <Search className="h-4 w-4" />
              Query
            </Button>
          </div>
        </form>

        {queryMutation.data && (
          <div className="mt-6 space-y-2">
            <div className="flex items-start gap-2">
              <Type className="text-muted-foreground mt-1 h-4 w-4" />
              <div>
                <span className="text-muted-foreground font-bold">
                  Response Type:
                </span>{" "}
                {queryMutation.data.responseType}
              </div>
            </div>
            <div className="flex items-start gap-2">
              <Code className="text-muted-foreground mt-1 h-4 w-4" />
              <div>
                <span className="text-muted-foreground font-bold">
                  Return Code:
                </span>{" "}
                {queryMutation.data.returnCode}
              </div>
            </div>
            <div className="flex items-start gap-2">
              <AlertCircle className="text-muted-foreground mt-1 h-4 w-4" />
              <div>
                <span className="text-muted-foreground font-bold">Reason:</span>{" "}
                {queryMutation.data.reason}
              </div>
            </div>
            <div className="flex items-start gap-2">
              <MessageSquare className="text-muted-foreground mt-1 h-4 w-4" />
              <div>
                <span className="text-muted-foreground font-bold">
                  Response:
                </span>{" "}
                {queryMutation.data.response}
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
