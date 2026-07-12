"use client";

import { Operations } from "~/components/dashboard/operations";
import { QueryLogs } from "~/components/dashboard/query-logs/query-logs";
import { QueryTool } from "~/components/dashboard/query-tool";
import { ServerStatus } from "~/components/dashboard/server-status";
import { ChartsSection } from "~/components/dashboard/statistics/charts-section";
import { StatisticsOverview } from "~/components/dashboard/statistics/statistics-overview";
import { StatisticsTopLists } from "~/components/dashboard/statistics/statistics-top-lists";
import { useDemoConfiguration } from "~/demo/context";

export function Dashboard({ showLogs }: { showLogs: boolean }) {
  const configuration = useDemoConfiguration();
  const showLogFeatures = showLogs && configuration.services.queryLogs;

  return (
    <div className="space-y-5 sm:space-y-6">
      <StatisticsOverview />
      <div className="grid gap-6 md:grid-cols-2">
        <ServerStatus />
        <Operations />
      </div>
      {showLogFeatures ? <ChartsSection /> : <StatisticsTopLists />}
      <QueryTool />
      {showLogFeatures ? <QueryLogs /> : null}
    </div>
  );
}
