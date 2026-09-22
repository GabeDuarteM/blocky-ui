"use client";

import { Radio, Search, Server } from "lucide-react";
import type { ChangeEvent } from "react";
import { type ReactNode, useCallback, useState } from "react";
import { ActionLayout } from "~/components/dashboard/action-layout";
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
import { Skeleton } from "~/components/ui/skeleton";
import { useServerQuery } from "~/hooks/use-server-query";
import { BLOCKY_DNS_RECORD_TYPES } from "~/lib/constants";
import { cn } from "~/lib/utils";
import type { RouterOutputs } from "~/trpc/react";

type DNS_RECORD_TYPE = (typeof BLOCKY_DNS_RECORD_TYPES)[number];
type QueryResult = Extract<
  RouterOutputs["servers"]["query"][number],
  { success: true }
>["data"];

function QueryResultCard({
  name,
  children,
}: {
  name: string;
  children: ReactNode;
}) {
  return (
    <section
      aria-label={`Query result for ${name}`}
      className="overflow-hidden rounded-lg border bg-card"
    >
      <div className="flex items-center gap-2 border-b px-5 py-3 font-medium text-sm">
        <Server className="size-4 shrink-0 text-muted-foreground" />
        <span className="min-w-0 break-words">{name}</span>
      </div>
      {children}
    </section>
  );
}

function QueryResultColumns({
  outcome,
  answers,
}: {
  outcome: ReactNode;
  answers: ReactNode;
}) {
  return (
    <div className="grid sm:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
      {outcome}
      {answers}
    </div>
  );
}

function QueryResultPane({
  responseType,
  returnCode,
  answers,
  detail,
}: QueryResult) {
  const occurrences = new Map<string, number>();
  const keyedAnswers = answers.map((answer) => {
    const occurrence = occurrences.get(answer) ?? 0;
    occurrences.set(answer, occurrence + 1);
    return { answer, key: JSON.stringify([answer, occurrence]) };
  });
  const answerLabel = answers.length === 1 ? "answer" : "answers";
  const isBlocked = responseType === "BLOCKED";

  return (
    <QueryResultColumns
      outcome={
        <div
          className={cn(
            "flex min-w-0 flex-col justify-between border-l-4 px-5 py-5",
            isBlocked
              ? "border-l-destructive bg-destructive/5"
              : "border-l-primary bg-primary/5",
          )}
        >
          <div className="flex items-center gap-2 text-xs uppercase tracking-widest">
            <Radio className="h-3.5 w-3.5" /> Query outcome
          </div>
          <div className="mt-8 min-w-0">
            <p className="break-all font-black text-3xl tracking-tight">
              {responseType}
            </p>
            <p className="mt-1 font-mono text-muted-foreground text-xs">
              {returnCode} / {answers.length} {answerLabel}
            </p>
            {detail ? (
              <p
                className="mt-2 truncate text-muted-foreground text-xs"
                title={detail}
              >
                {detail}
              </p>
            ) : null}
          </div>
        </div>
      }
      answers={
        <div className="flex max-h-64 min-h-0 min-w-0 flex-col gap-3 px-5 py-5 sm:border-l">
          <p className="text-muted-foreground text-xs uppercase tracking-wide">
            DNS answers
          </p>
          {answers.length === 0 ? (
            <p className="text-muted-foreground text-sm">No answer returned</p>
          ) : (
            <div className="min-h-0 space-y-3 overflow-y-auto overscroll-contain pr-2">
              {keyedAnswers.map(({ answer, key }, index) => (
                <div key={key} className="flex items-baseline gap-3">
                  <span className="font-mono text-muted-foreground text-xs">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <span className="min-w-0 select-text break-all font-mono text-lg">
                    {answer}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      }
    />
  );
}

export function QueryTool({ controls }: { controls?: ReactNode }) {
  const serverQuery = useServerQuery();
  const [query, setQuery] = useState("");
  const [type, setType] = useState<DNS_RECORD_TYPE>(BLOCKY_DNS_RECORD_TYPES[0]);

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      if (!query) {
        return;
      }
      serverQuery.execute({
        query,
        type,
      });
    },
    [serverQuery, type, query],
  );

  const handleQueryChange = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => setQuery(e.target.value),
    [],
  );
  const handleTypeChange = useCallback(
    (value: DNS_RECORD_TYPE) => setType(value),
    [],
  );
  return (
    <Card role="region" aria-label="Query Tool">
      <CardHeader>
        <CardTitle className="flex flex-wrap items-center justify-between gap-2">
          <span className="flex items-center gap-2">
            <Search className="h-5 w-5" />
            Query Tool
          </span>
        </CardTitle>
        <CardDescription>Test DNS resolution for a domain</CardDescription>
      </CardHeader>
      <CardContent>
        <ActionLayout controls={controls}>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="flex flex-col gap-2 sm:flex-row">
              <Input
                aria-label="Domain to query"
                controlSize="responsive"
                placeholder="Enter domain (e.g., example.com)"
                value={query}
                onChange={handleQueryChange}
                className="sm:flex-1"
              />
              <Select value={type} onValueChange={handleTypeChange}>
                <SelectTrigger
                  aria-label="DNS record type"
                  size="responsive"
                  className="w-full sm:w-26"
                >
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
                size="responsive"
                type="submit"
                variant="outline"
                disabled={serverQuery.isPending}
                className="flex items-center justify-center gap-2"
              >
                <Search className="h-4 w-4" />
                Query
              </Button>
            </div>
          </form>

          {serverQuery.results.length > 0 || serverQuery.isPending ? (
            <div className="@container mt-5">
              <section
                aria-label="DNS query results"
                aria-live="polite"
                aria-busy={serverQuery.isPending}
                // biome-ignore lint/a11y/noNoninteractiveTabindex: Safari needs explicit focus to let keyboard users scroll this results panel.
                tabIndex={0}
                className="-mr-5 max-h-[min(36rem,70vh)] overflow-y-auto overscroll-contain [color-scheme:dark]"
              >
                <div className="w-[100cqw] space-y-4">
                  {serverQuery.results.length === 0 &&
                    serverQuery.pendingServerIds.map((id) => (
                      <QueryResultCard
                        key={id}
                        name={serverQuery.names[id] ?? id}
                      >
                        <QueryResultColumns
                          outcome={
                            <div className="space-y-8 border-muted border-l-4 px-5 py-5">
                              <Skeleton className="h-4 w-28" />
                              <div className="space-y-2">
                                <Skeleton className="h-9 w-36" />
                                <Skeleton className="h-4 w-24" />
                              </div>
                            </div>
                          }
                          answers={
                            <div className="space-y-3 px-5 py-5 sm:border-l">
                              <Skeleton className="h-4 w-24" />
                              <Skeleton className="h-6 w-3/4" />
                            </div>
                          }
                        />
                      </QueryResultCard>
                    ))}
                  {serverQuery.results.map((result) => (
                    <QueryResultCard
                      key={result.serverId}
                      name={
                        serverQuery.names[result.serverId] ?? result.serverId
                      }
                    >
                      {result.success ? (
                        <QueryResultPane {...result.data} />
                      ) : (
                        <p className="px-5 py-5 text-destructive text-sm">
                          {result.error.message}
                        </p>
                      )}
                    </QueryResultCard>
                  ))}
                </div>
              </section>
            </div>
          ) : null}
        </ActionLayout>
      </CardContent>
    </Card>
  );
}
