"use client";

import { Activity, ChartPie, Database, List } from "lucide-react";
import { formatCount } from "~/lib/utils";
import { api } from "~/trpc/react";
import { StatCard } from "./stat-card";

export function StatisticsOverview() {
  const { data: snapshot, isLoading } = api.stats.snapshot.useQuery();
  const overview = snapshot?.overview;

  if (!isLoading && !overview) {
    return null;
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <StatCard
        title="Total Queries"
        value={overview?.totalQueries ?? 0}
        icon={Activity}
        isLoading={isLoading}
        tooltip="Last 24 hours"
        detail={
          overview
            ? `${overview.avgResponseMs} ms avg. response`
            : "0 ms avg. response"
        }
      />
      <StatCard
        title="Query Outcomes"
        value={overview?.blocked ?? 0}
        valueLabel="blocked"
        icon={ChartPie}
        badge={
          overview
            ? {
                value: `${overview.blockedPercentage.toFixed(1)}%`,
                variant: "destructive",
              }
            : undefined
        }
        isLoading={isLoading}
        tooltip="Blocked, dropped, and failed queries in the last 24 hours"
        detail={
          overview
            ? `${formatCount(overview.dropped)} dropped · ${formatCount(overview.errors)} errors`
            : "0 dropped · 0 errors"
        }
      />
      <StatCard
        title="Cache Hit Rate"
        value={overview ? `${overview.cacheHitRate.toFixed(1)}%` : "0%"}
        icon={Database}
        isLoading={isLoading}
        tooltip="Percentage of cache lookups served from cache in the last 24 hours"
        detail={
          overview
            ? `${formatCount(overview.cacheEntries)} cached entries`
            : "0 cached entries"
        }
      />
      <StatCard
        title="Listed Domains"
        value={overview?.listedDomains ?? 0}
        icon={List}
        isLoading={isLoading}
        tooltip="Total domains in blocklists"
        detail={
          overview
            ? `${overview.denylistGroups} groups · ${formatCount(overview.allowlistDomains)} allowed`
            : "0 groups · 0 allowed"
        }
      />
    </div>
  );
}
