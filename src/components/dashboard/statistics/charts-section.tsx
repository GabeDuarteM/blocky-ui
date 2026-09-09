"use client";

import { useState } from "react";
import { useDashboardServers } from "~/components/dashboard/server-context";
import { QueriesOverTimeChart } from "./queries-over-time-chart";
import { TopListTable } from "./top-list-table";
import { TimeRangeSelector } from "./time-range-selector";
import { TopListsSection } from "./top-list";
import { type TimeRange } from "~/lib/constants";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { ListOrdered } from "lucide-react";

const ROWS_OPTIONS = [5, 10, 25, 50] as const;
type RowsOption = (typeof ROWS_OPTIONS)[number];

export function ChartsSection() {
  const [chartRange, setChartRange] = useState<TimeRange>("24h");
  const [topListsRange, setTopListsRange] = useState<TimeRange>("24h");
  const [rowsPerTable, setRowsPerTable] = useState<RowsOption>(5);
  const dashboard = useDashboardServers();
  const scopeKey = JSON.stringify(dashboard.selection.selected("view"));
  const [pageState, setPageState] = useState({
    scopeKey,
    domains: 0,
    clients: 0,
  });
  const pages =
    pageState.scopeKey === scopeKey ? pageState : { domains: 0, clients: 0 };
  const setPage = (type: "domains" | "clients", page: number) => {
    setPageState({ scopeKey, ...pages, [type]: page });
  };

  const resetPages = () => {
    setPageState({ scopeKey, domains: 0, clients: 0 });
  };

  const handleTopListsRangeChange = (range: TimeRange) => {
    setTopListsRange(range);
    resetPages();
  };

  const handleRowsChange = (value: string) => {
    const rows = ROWS_OPTIONS.find((option) => String(option) === value);
    if (!rows) {
      return;
    }
    setRowsPerTable(rows);
    resetPages();
  };

  return (
    <div className="space-y-6">
      <QueriesOverTimeChart range={chartRange} onRangeChange={setChartRange} />
      <TopListsSection
        description="Most active domains and clients"
        icon={ListOrdered}
        controls={
          <div className="flex flex-wrap items-center gap-2 sm:justify-end">
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground text-xs">Rows</span>
              <Select
                value={String(rowsPerTable)}
                onValueChange={handleRowsChange}
              >
                <SelectTrigger size="sm" className="w-18 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ROWS_OPTIONS.map((option) => (
                    <SelectItem key={option} value={String(option)}>
                      {option}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <TimeRangeSelector
              value={topListsRange}
              onChange={handleTopListsRangeChange}
            />
          </div>
        }
      >
        <TopListTable
          type="domains"
          range={topListsRange}
          limit={rowsPerTable}
          page={pages.domains}
          onPageChange={(page) => setPage("domains", page)}
        />
        <TopListTable
          type="clients"
          range={topListsRange}
          limit={rowsPerTable}
          page={pages.clients}
          onPageChange={(page) => setPage("clients", page)}
        />
      </TopListsSection>
    </div>
  );
}
