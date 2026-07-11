"use client";

import { Radio, Search } from "lucide-react";
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
import { BLOCKY_DNS_RECORD_TYPES } from "~/lib/constants";
import { cn } from "~/lib/utils";
import { type BlockyQueryResult } from "~/server/blocky/query";

type DNS_RECORD_TYPE = (typeof BLOCKY_DNS_RECORD_TYPES)[number];

function QueryResultPane({
  responseType,
  returnCode,
  answers,
  detail,
}: BlockyQueryResult) {
  const answerLabel = answers.length === 1 ? "answer" : "answers";
  const isBlocked = responseType === "BLOCKED";

  return (
    <section
      aria-live="polite"
      className="mt-6 grid overflow-hidden rounded-md sm:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]"
    >
      <div
        className={cn(
          "flex min-w-0 flex-col justify-between border-l-4 px-5 py-5",
          isBlocked
            ? "border-l-destructive bg-destructive/5"
            : "border-l-primary bg-primary/5",
        )}
      >
        <div className="flex items-center gap-2 text-xs tracking-widest uppercase">
          <Radio className="h-3.5 w-3.5" /> Query outcome
        </div>
        <div className="mt-8 min-w-0">
          <p className="text-3xl font-black tracking-tight break-all">
            {responseType}
          </p>
          <p className="text-muted-foreground mt-1 font-mono text-xs">
            {returnCode} / {answers.length} {answerLabel}
          </p>
          {detail && (
            <p
              className="text-muted-foreground mt-2 truncate text-xs"
              title={detail}
            >
              {detail}
            </p>
          )}
        </div>
      </div>
      <div className="flex max-h-60 min-h-0 min-w-0 flex-col gap-3 px-5 py-5 sm:border-l">
        <p className="text-muted-foreground text-xs tracking-wide uppercase">
          DNS answers
        </p>
        {answers.length === 0 ? (
          <p className="text-muted-foreground text-sm">No answer returned</p>
        ) : (
          <div className="min-h-0 space-y-3 overflow-y-auto overscroll-contain pr-2">
            {answers.map((answer, index) => (
              <div
                key={`${answer}-${index}`}
                className="flex items-baseline gap-3"
              >
                <span className="text-muted-foreground font-mono text-xs">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <span className="min-w-0 font-mono text-lg break-all select-text">
                  {answer}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

export function QueryTool() {
  const [query, setQuery] = useState("");
  const [type, setType] = useState<DNS_RECORD_TYPE>(BLOCKY_DNS_RECORD_TYPES[0]);

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
          <div className="flex flex-col gap-2 sm:flex-row">
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
              <SelectTrigger className="w-full sm:w-26">
                <SelectValue placeholder="Type" />
              </SelectTrigger>
              <SelectContent>
                {BLOCKY_DNS_RECORD_TYPES.map((recordType) => (
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
              className="flex items-center justify-center gap-2"
            >
              <Search className="h-4 w-4" />
              Query
            </Button>
          </div>
        </form>

        {queryMutation.data && <QueryResultPane {...queryMutation.data} />}
      </CardContent>
    </Card>
  );
}
