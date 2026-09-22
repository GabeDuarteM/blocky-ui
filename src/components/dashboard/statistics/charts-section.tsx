"use client";

import { ListOrdered } from "lucide-react";
import { useCallback, useState } from "react";
import { useDashboardServers } from "~/components/dashboard/server-context";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import type { TimeRange } from "~/lib/constants";
import { QueriesOverTimeChart } from "./queries-over-time-chart";
import { TimeRangeSelector } from "./time-range-selector";
import { TopListsSection } from "./top-list";
import { TopListTable } from "./top-list-table";

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
  const setPage = useCallback(
    (type: "domains" | "clients", page: number) => {
      setPageState((previous) => ({
        ...(previous.scopeKey === scopeKey
          ? previous
          : { domains: 0, clients: 0 }),
        scopeKey,
        [type]: page,
      }));
    },
    [scopeKey],
  );

  const resetPages = useCallback(() => {
    setPageState({ scopeKey, domains: 0, clients: 0 });
  }, [scopeKey]);

  const handleTopListsRangeChange = useCallback(
    (range: TimeRange) => {
      setTopListsRange(range);
      resetPages();
    },
    [resetPages],
  );

  const handleRowsChange = useCallback(
    (value: string) => {
      const rows = ROWS_OPTIONS.find((option) => String(option) === value);
      if (!rows) {
        return;
      }
      setRowsPerTable(rows);
      resetPages();
    },
    [resetPages],
  );

  const setDomainPage = useCallback(
    (page: number) => setPage("domains", page),
    [setPage],
  );
  const setClientPage = useCallback(
    (page: number) => setPage("clients", page),
    [setPage],
  );
  return (
    <div className="space-y-6">
      <QueriesOverTimeChart range={chartRange} onRangeChange={setChartRange} />
      <TopListsSection
        description="Most active domains and clients"
        icon={ListOrdered}
        controls={
          <div className="flex flex-wrap items-center gap-2 sm:justify-end">
            <div className="shrink-0">
              <Select
                value={String(rowsPerTable)}
                onValueChange={handleRowsChange}
              >
                <SelectTrigger
                  size="responsive"
                  aria-label="Top list rows per page"
                  className="w-auto min-w-24"
                >
                  <SelectValue>{rowsPerTable} rows</SelectValue>
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
          onPageChange={setDomainPage}
        />
        <TopListTable
          type="clients"
          range={topListsRange}
          limit={rowsPerTable}
          page={pages.clients}
          onPageChange={setClientPage}
        />
      </TopListsSection>
    </div>
  );
}
