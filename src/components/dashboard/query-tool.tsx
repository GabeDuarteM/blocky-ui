"use client";

import { Button } from "~/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Input } from "~/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { api } from "~/trpc/react";
import { useState } from "react";

const QUERY_TYPES = ["A", "AAAA", "CNAME", "MX", "TXT", "SRV", "PTR"];

interface QueryResult {
  type: string;
  code: string;
  reason: string;
  response: string;
}

export function QueryTool() {
  const [query, setQuery] = useState("");
  const [type, setType] = useState("A");
  const [result, setResult] = useState<QueryResult | null>(null);

  const queryMutation = api.blocky.queryExecute.useMutation({
    onSuccess: (data) => {
      setResult({
        type: type,
        code: data.returnCode,
        reason: data.reason,
        response: data.response,
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    queryMutation.mutate({
      query: query,
      type: type,
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>DNS Query Tool</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="flex gap-2">
            <Input
              placeholder="Enter domain (e.g., example.com)"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            <Select value={type} onValueChange={setType}>
              <SelectTrigger className="w-[120px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {QUERY_TYPES.map((t) => (
                  <SelectItem key={t} value={t}>
                    {t}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button type="submit" disabled={queryMutation.isPending}>
              Query
            </Button>
          </div>

          {result && (
            <div className="space-y-2 rounded-lg border p-4">
              <div>
                <span className="font-medium">Response Type: </span>
                {result.type}
              </div>
              <div>
                <span className="font-medium">Return Code: </span>
                {result.code}
              </div>
              <div>
                <span className="font-medium">Reason: </span>
                {result.reason}
              </div>
              <div>
                <span className="font-medium">Response: </span>
                {result.response}
              </div>
            </div>
          )}
        </form>
      </CardContent>
    </Card>
  );
}
