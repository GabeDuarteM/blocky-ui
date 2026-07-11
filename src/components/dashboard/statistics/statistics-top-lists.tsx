"use client";

import { useState, type ReactNode } from "react";
import { Globe, ListOrdered, Users, type LucideIcon } from "lucide-react";

import { Button } from "~/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import { FloatingCard } from "~/components/ui/floating-card";
import { Skeleton } from "~/components/ui/skeleton";
import { cn, formatCount } from "~/lib/utils";
import { api } from "~/trpc/react";

const DISPLAYED_ENTRIES = 5;

interface NameCount {
  name: string;
  count: number;
}

interface StatisticsTopListProps {
  title: string;
  description: string;
  icon: LucideIcon;
  entries: NameCount[];
  headerAction?: ReactNode;
}

function StatisticsTopList({
  title,
  description,
  icon: Icon,
  entries,
  headerAction,
}: StatisticsTopListProps) {
  const displayedEntries = entries.slice(0, DISPLAYED_ENTRIES);
  const maxCount = displayedEntries[0]?.count ?? 0;

  return (
    <Card className="bg-muted/30 min-w-0 border-0 shadow-none">
      <CardHeader>
        <div className="flex w-full flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <CardTitle className="flex items-center gap-2 text-base font-medium">
              <Icon className="h-5 w-5" />
              {title}
            </CardTitle>
            <CardDescription>{description}</CardDescription>
          </div>
          {headerAction}
        </div>
      </CardHeader>
      <CardContent>
        {displayedEntries.length === 0 ? (
          <p className="text-muted-foreground py-8 text-center text-sm">
            No data available
          </p>
        ) : (
          <div className="-my-1.5">
            {displayedEntries.map((entry) => {
              const barWidth =
                maxCount > 0 ? (entry.count / maxCount) * 100 : 0;

              return (
                <FloatingCard
                  key={entry.name}
                  content={
                    <div className="flex items-center justify-between gap-4">
                      <span className="font-mono text-sm">{entry.name}</span>
                      <span className="shrink-0 font-medium tabular-nums">
                        {entry.count.toLocaleString()}
                      </span>
                    </div>
                  }
                >
                  <div className="cursor-default space-y-1 py-1.5">
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate font-mono text-sm">
                        {entry.name}
                      </span>
                      <span className="text-muted-foreground shrink-0 text-sm tabular-nums">
                        {formatCount(entry.count)}
                      </span>
                    </div>
                    <div className="bg-muted h-2 w-full overflow-hidden rounded-full">
                      <div
                        className="h-full rounded-full bg-[var(--chart-1)]/75 transition-all duration-300"
                        style={{ width: `${barWidth}%` }}
                      />
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

function StatisticsTopListsSkeleton() {
  return (
    <div className="grid gap-6 md:grid-cols-2">
      {Array.from({ length: 2 }).map((_, index) => (
        <Card key={index} className="bg-muted/30 min-w-0 border-0 shadow-none">
          <CardHeader>
            <Skeleton className="h-5 w-32" />
            <Skeleton className="h-4 w-40" />
          </CardHeader>
          <CardContent className="space-y-3">
            {Array.from({ length: DISPLAYED_ENTRIES }).map((_, rowIndex) => (
              <Skeleton key={rowIndex} className="h-8 w-full" />
            ))}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

export function StatisticsTopLists() {
  const [domainFilter, setDomainFilter] = useState<"all" | "blocked">("all");
  const { data: snapshot, isLoading } = api.stats.snapshot.useQuery();

  if (!isLoading && !snapshot) {
    return null;
  }

  const domainEntries =
    domainFilter === "all"
      ? snapshot?.topLists.domains
      : snapshot?.topLists.blockedDomains;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base font-medium">
          <ListOrdered className="h-5 w-5" />
          Top Lists
        </CardTitle>
        <CardDescription>
          Most active domains and clients in the last 24 hours
        </CardDescription>
      </CardHeader>
      <CardContent>
        {snapshot ? (
          <div className="grid gap-6 md:grid-cols-2">
            <StatisticsTopList
              title="Top Domains"
              description={
                domainFilter === "all"
                  ? "Most frequently queried domains"
                  : "Most frequently blocked domains"
              }
              icon={Globe}
              entries={domainEntries ?? []}
              headerAction={
                <div className="flex gap-1 sm:justify-end">
                  <Button
                    variant={domainFilter === "all" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setDomainFilter("all")}
                    className={cn(
                      "h-7 px-2.5 text-xs",
                      domainFilter === "all" && "border border-transparent",
                    )}
                  >
                    All
                  </Button>
                  <Button
                    variant={domainFilter === "blocked" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setDomainFilter("blocked")}
                    className={cn(
                      "h-7 px-2.5 text-xs",
                      domainFilter === "blocked" && "border border-transparent",
                    )}
                  >
                    Blocked
                  </Button>
                </div>
              }
            />
            <StatisticsTopList
              title="Top Clients"
              description="Devices with the most queries"
              icon={Users}
              entries={snapshot.topLists.clients}
            />
          </div>
        ) : (
          <StatisticsTopListsSkeleton />
        )}
      </CardContent>
    </Card>
  );
}
