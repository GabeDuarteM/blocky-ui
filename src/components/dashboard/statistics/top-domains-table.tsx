"use client";

import { useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import { Globe } from "lucide-react";
import { Button } from "~/components/ui/button";
import { Skeleton } from "~/components/ui/skeleton";
import { FloatingCard } from "~/components/ui/floating-card";
import { cn, formatCount } from "~/lib/utils";
import { api } from "~/trpc/react";
import { type TimeRange } from "~/lib/constants";

interface TopDomainsTableProps {
  range: TimeRange;
}

type FilterType = "all" | "blocked";

export function TopDomainsTable({ range }: TopDomainsTableProps) {
  const [filter, setFilter] = useState<FilterType>("all");

  const { data, isLoading } = api.stats.topDomains.useQuery({
    range,
    limit: 5,
    filter,
  });

  const maxCount = data?.[0]?.count ?? 0;

  return (
    <Card>
      <CardHeader>
        <div className="flex w-full flex-row items-center justify-between">
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <CardTitle className="flex items-center gap-2 text-base font-medium">
              <Globe className="h-5 w-5" />
              Top Domains
            </CardTitle>
            <CardDescription>Most frequently queried domains</CardDescription>
          </div>
          <div className="flex gap-1">
            <Button
              variant={filter === "all" ? "default" : "outline"}
              size="sm"
              onClick={() => setFilter("all")}
              className={cn(
                "h-7 px-2.5 text-xs",
                filter === "all" && "border border-transparent",
              )}
            >
              All
            </Button>
            <Button
              variant={filter === "blocked" ? "default" : "outline"}
              size="sm"
              onClick={() => setFilter("blocked")}
              className={cn(
                "h-7 px-2.5 text-xs",
                filter === "blocked" && "border border-transparent",
              )}
            >
              Blocked
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-8 w-full" />
            ))}
          </div>
        ) : data?.length === 0 ? (
          <p className="text-muted-foreground py-8 text-center text-sm">
            No data available
          </p>
        ) : (
          <div className="-my-1.5">
            {data?.map((entry) => {
              const barWidth =
                maxCount > 0 ? (entry.count / maxCount) * 100 : 0;
              const blockedPercentage =
                entry.count > 0 ? (entry.blocked / entry.count) * 100 : 0;

              const isBlockedFilter = filter === "blocked";

              return (
                <FloatingCard
                  key={entry.domain}
                  content={
                    <div className="space-y-3">
                      <p
                        className="truncate font-mono text-sm font-medium"
                        title={entry.domain}
                      >
                        {entry.domain}
                      </p>
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <div className="h-2 w-2 rounded-full bg-[var(--chart-1)]" />
                            <span className="text-muted-foreground text-sm">
                              {isBlockedFilter ? "Blocked" : "Total"}
                            </span>
                          </div>
                          <span className="font-medium tabular-nums">
                            {entry.count.toLocaleString()} (
                            {entry.percentage.toFixed(1)}%)
                          </span>
                        </div>
                        {!isBlockedFilter && entry.blocked > 0 && (
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <div className="h-2 w-2 rounded-full bg-[var(--chart-5)]" />
                              <span className="text-muted-foreground text-sm">
                                Blocked
                              </span>
                            </div>
                            <span className="font-medium tabular-nums">
                              {entry.blocked.toLocaleString()} (
                              {blockedPercentage.toFixed(1)}%)
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  }
                >
                  <div className="cursor-default space-y-1 py-1.5">
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate font-mono text-sm">
                        {entry.domain}
                      </span>
                      <span className="text-muted-foreground shrink-0 text-sm tabular-nums">
                        {formatCount(entry.count)}
                      </span>
                    </div>
                    <div className="bg-muted h-2 w-full overflow-hidden rounded-full">
                      <div
                        className="relative h-full rounded-full bg-[var(--chart-1)] transition-all duration-300"
                        style={{ width: `${barWidth}%` }}
                      >
                        {!isBlockedFilter && entry.blocked > 0 && (
                          <div
                            className="absolute top-0 right-0 h-full rounded-r-full bg-[var(--chart-5)]"
                            style={{ width: `${blockedPercentage}%` }}
                          />
                        )}
                      </div>
                    </div>
                  </div>
                </FloatingCard>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
