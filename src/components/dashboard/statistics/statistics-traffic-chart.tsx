"use client";

import { useDashboardServers } from "~/components/dashboard/server-context";
import { TrafficChart } from "~/components/dashboard/statistics/queries-over-time-chart";
import { aggregateStatisticsTraffic } from "~/lib/aggregate-statistics";

export function StatisticsTrafficChart() {
  const dashboard = useDashboardServers();
  const data = aggregateStatisticsTraffic(dashboard.statistics ?? []);

  if (!dashboard.statisticsLoading && data === null) {
    return null;
  }

  return (
    <TrafficChart
      range="24h"
      data={data ?? undefined}
      isLoading={dashboard.statisticsLoading}
      series={["total", "blocked"]}
    />
  );
}
