"use client";

import { useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import { ChevronLeft, ChevronRight, Users } from "lucide-react";
import { Button } from "~/components/ui/button";
import { PageNumbers } from "~/components/ui/page-numbers";
import { Skeleton } from "~/components/ui/skeleton";
import { FloatingCard } from "~/components/ui/floating-card";
import { cn, formatCount } from "~/lib/utils";
import { api } from "~/trpc/react";
import { type TimeRange } from "~/lib/constants";

interface TopClientsTableProps {
  range: TimeRange;
  limit: number;
}

type FilterType = "all" | "blocked";

export function TopClientsTable({ range, limit }: TopClientsTableProps) {
  const [filter, setFilter] = useState<FilterType>("all");
  const [page, setPage] = useState(0);

  const { data, isFetching } = api.stats.topClients.useQuery(
    {
      range,
      limit,
      offset: page * limit,
      filter,
    },
    { placeholderData: (prev) => prev },
  );

  const items = data?.items ?? [];
  const totalCount = data?.totalCount ?? 0;
  const totalPages = Math.ceil(totalCount / limit);
  const showPagination = totalPages > 1;

  const utils = api.useUtils();

  if (page > 0) {
    void utils.stats.topClients.prefetch({
      range,
      limit,
      offset: (page - 1) * limit,
      filter,
    });
  }

  if (page < totalPages - 1) {
    void utils.stats.topClients.prefetch({
      range,
      limit,
      offset: (page + 1) * limit,
      filter,
    });
  }
  const maxTotal = items[0]?.total ?? 0;

  const handleFilterChange = (newFilter: FilterType) => {
    setFilter(newFilter);
    setPage(0);
  };

  const isBlockedFilter = filter === "blocked";

  return (
    <Card className="bg-muted/30 flex flex-col border-0 shadow-none">
      <CardHeader>
        <div className="flex w-full flex-row items-center justify-between">
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <CardTitle className="flex items-center gap-2 text-base font-medium">
              <Users className="h-5 w-5" />
              Top Clients
            </CardTitle>
            <CardDescription>Devices with the most DNS queries</CardDescription>
          </div>
          <div className="flex gap-1">
            <Button
              variant={filter === "all" ? "default" : "outline"}
              size="sm"
              onClick={() => handleFilterChange("all")}
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
              onClick={() => handleFilterChange("blocked")}
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
      <CardContent className="flex-1">
        {isFetching ? (
          <div className="space-y-3">
            {Array.from({ length: limit }).map((_, i) => (
              <Skeleton key={i} className="h-8 w-full" />
            ))}
          </div>
        ) : items.length === 0 ? (
          <p className="text-muted-foreground py-8 text-center text-sm">
            No data available
          </p>
        ) : (
          <div className="-my-1.5">
            {items.map((entry) => {
              const barWidth =
                maxTotal > 0 ? (entry.total / maxTotal) * 100 : 0;
              const blockedPercentage =
                entry.total > 0 ? (entry.blocked / entry.total) * 100 : 0;

              return (
                <FloatingCard
                  key={entry.client}
                  content={
                    <div className="space-y-3">
                      <p
                        className="truncate font-mono text-sm font-medium"
                        title={entry.client}
                      >
                        {entry.client}
                      </p>
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <div
                              className={cn(
                                "h-2 w-2 rounded-full",
                                isBlockedFilter
                                  ? "bg-[var(--chart-5-muted)]"
                                  : "bg-[var(--chart-1)]/75",
                              )}
                            />
                            <span className="text-muted-foreground text-sm">
                              {isBlockedFilter ? "Blocked" : "Total"}
                            </span>
                          </div>
                          <span className="font-medium tabular-nums">
                            {entry.total.toLocaleString()} (
                            {entry.percentage.toFixed(1)}%)
                          </span>
                        </div>
                        {!isBlockedFilter && entry.blocked > 0 && (
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <div className="h-2 w-2 rounded-full bg-[var(--chart-5-muted)]" />
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
                        {entry.client}
                      </span>
                      <span className="text-muted-foreground shrink-0 text-sm tabular-nums">
                        {formatCount(entry.total)}
                      </span>
                    </div>
                    <div className="bg-muted flex h-2 w-full overflow-hidden rounded-full">
                      {isBlockedFilter ? (
                        <div
                          className="h-full rounded-full bg-[var(--chart-5-muted)] transition-all duration-300"
                          style={{ width: `${barWidth}%` }}
                        />
                      ) : (
                        <>
                          <div
                            className="h-full rounded-l-full bg-[var(--chart-1)]/75 transition-all duration-300"
                            style={{
                              width: `${barWidth * (1 - blockedPercentage / 100)}%`,
                            }}
                          />
                          {entry.blocked > 0 && (
                            <div
                              className="h-full rounded-r-full bg-[var(--chart-5-muted)] transition-all duration-300"
                              style={{
                                width: `${barWidth * (blockedPercentage / 100)}%`,
                              }}
                            />
                          )}
                        </>
                      )}
                    </div>
                  </div>
                </FloatingCard>
              );
            })}
          </div>
        )}
      </CardContent>
      {showPagination && (
        <CardFooter className="justify-between border-t pt-4">
          <span className="text-muted-foreground text-xs tabular-nums">
            {page * limit + 1}-{Math.min((page + 1) * limit, totalCount)} of{" "}
            {totalCount}
          </span>
          <div className="flex gap-1">
            <Button
              variant="outline"
              size="icon"
              className="h-7 w-7"
              onClick={() => setPage((p) => p - 1)}
              disabled={page === 0}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <PageNumbers
              currentPage={page}
              totalPages={totalPages}
              onPageChange={setPage}
            />
            <Button
              variant="outline"
              size="icon"
              className="h-7 w-7"
              onClick={() => setPage((p) => p + 1)}
              disabled={page >= totalPages - 1}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </CardFooter>
      )}
    </Card>
  );
}
