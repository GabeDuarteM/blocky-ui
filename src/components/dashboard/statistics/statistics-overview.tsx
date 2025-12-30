"use client";

import { Activity, Ban, Database, List } from "lucide-react";
import { api } from "~/trpc/react";
import { StatCard } from "./stat-card";

export function StatisticsOverview() {
  const { data: status, isLoading: statusLoading } =
    api.stats.prometheusStatus.useQuery();
  const { data: overview, isLoading: overviewLoading } =
    api.stats.overview.useQuery(undefined, {
      enabled: status?.available ?? false,
    });

  const isLoading = statusLoading || overviewLoading;
  const showStats = status?.available && overview;

  if (!statusLoading && !status?.available) {
    return null;
  }

  const hasLogProvider = showStats && overview.hasLogProvider;

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <StatCard
        title="Total Queries"
        value={showStats ? overview.totalQueries : 0}
        icon={Activity}
        isLoading={isLoading}
        tooltip={hasLogProvider ? "Last 24 hours" : "Since Blocky started"}
      />
      <StatCard
        title="Blocked"
        value={showStats ? overview.blocked : 0}
        icon={Ban}
        badge={
          showStats
            ? {
                value: `${overview.blockedPercentage.toFixed(1)}%`,
                variant: "destructive",
              }
            : undefined
        }
        isLoading={isLoading}
        tooltip={hasLogProvider ? "Last 24 hours" : "Since Blocky started"}
      />
      <StatCard
        title="Cache Hit Rate"
        value={showStats ? `${overview.cacheHitRate.toFixed(1)}%` : "0%"}
        icon={Database}
        progress={showStats ? overview.cacheHitRate : 0}
        isLoading={isLoading}
        tooltip="Percentage of queries answered from cache (since Blocky started)"
      />
      <StatCard
        title="Listed Domains"
        value={showStats ? overview.listedDomains : 0}
        icon={List}
        isLoading={isLoading}
        tooltip="Total domains in blocklists"
      />
    </div>
  );
}
