"use client";

import { aggregateStatistics } from "~/lib/aggregate-statistics";
import { useDashboardServers } from "~/components/dashboard/server-context";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "~/components/ui/popover";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "~/components/ui/table";
import { Button } from "~/components/ui/button";
import { Activity, ChartPie, Database, List, ChevronDown } from "lucide-react";
import { formatCount } from "~/lib/utils";
import { StatCard } from "./stat-card";

export function StatisticsOverview() {
  const dashboard = useDashboardServers();
  const overview = aggregateStatistics(dashboard.statistics ?? []);
  const isLoading = dashboard.statisticsLoading;
  const inventories =
    dashboard.statistics?.flatMap((result) =>
      result.success
        ? [
            {
              id: result.serverId,
              name:
                dashboard.servers.find(
                  (server) => server.id === result.serverId,
                )?.name ?? result.serverId,
              ...result.data.overview,
            },
          ]
        : [],
    ) ?? [];
  const inventory = inventories[0];
  const domainCounts = inventories.map((server) => server.listedDomains);
  const minimum = domainCounts.length ? Math.min(...domainCounts) : 0;
  const maximum = domainCounts.length ? Math.max(...domainCounts) : 0;
  const domainRange =
    minimum === maximum
      ? formatCount(minimum)
      : `${formatCount(minimum)} to ${formatCount(maximum)}`;

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
      {dashboard.selection.selected("view").length > 1 ? (
        <StatCard title="Listed Domains" icon={List} isLoading={isLoading}>
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="ghost"
                aria-label="View listed domains by server"
                className="hover:bg-accent -mx-2 -my-1 h-17 w-[calc(100%+1rem)] flex-col items-start gap-2 px-2 py-1 text-left"
              >
                <span className="flex w-full items-center justify-between gap-2">
                  <span className="text-xl font-bold tabular-nums">
                    {domainRange}
                  </span>
                  <ChevronDown className="text-muted-foreground size-4 shrink-0" />
                </span>
                <span className="text-muted-foreground text-xs font-normal">
                  {minimum === maximum ? "Per server" : "Range per server"}
                </span>
              </Button>
            </PopoverTrigger>
            <PopoverContent
              align="end"
              collisionPadding={16}
              className="bg-popover dark:bg-popover w-132 max-w-[calc(100vw-2rem)] p-0"
              aria-label="Listed domains by server"
            >
              <div className="max-h-[min(32rem,60vh,var(--radix-popover-content-available-height))] [scrollbar-gutter:stable] overflow-y-auto overscroll-contain rounded-md [color-scheme:dark] [&>[data-slot=table-container]]:overflow-visible">
                <Table className="table-fixed text-xs sm:text-sm">
                  <TableHeader className="bg-popover sticky top-0 z-10">
                    <TableRow className="hover:bg-transparent [&>th]:h-auto [&>th]:py-3 [&>th]:leading-5">
                      <TableHead className="w-[30%] pl-4">Server</TableHead>
                      <TableHead className="w-[22%] text-right">
                        Domains
                      </TableHead>
                      <TableHead className="w-[24%] text-right">
                        Allowlisted
                      </TableHead>
                      <TableHead className="w-[24%] pr-4 text-right whitespace-normal">
                        Deny groups
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {inventories.map((server) => (
                      <TableRow key={server.id}>
                        <TableCell className="py-3 pl-4 font-medium break-words whitespace-normal">
                          {server.name}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {server.listedDomains.toLocaleString()}
                        </TableCell>
                        <TableCell className="text-muted-foreground text-right tabular-nums">
                          {server.allowlistDomains.toLocaleString()}
                        </TableCell>
                        <TableCell className="text-muted-foreground pr-4 text-right tabular-nums">
                          {server.denylistGroups}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </PopoverContent>
          </Popover>
        </StatCard>
      ) : (
        <StatCard
          title="Listed Domains"
          value={inventory?.listedDomains ?? 0}
          icon={List}
          isLoading={isLoading}
          tooltip="Total domains in blocklists"
          detail={
            inventory
              ? `${inventory.denylistGroups} deny groups · ${formatCount(inventory.allowlistDomains)} allowlisted`
              : "0 deny groups · 0 allowlisted"
          }
        />
      )}
    </div>
  );
}
