"use client";

import { useState } from "react";
import { QueriesOverTimeChart } from "./queries-over-time-chart";
import { TopDomainsTable } from "./top-domains-table";
import { TopClientsTable } from "./top-clients-table";
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
  const [pages, setPages] = useState({ domains: 0, clients: 0 });

  const resetPages = () => {
    setPages({ domains: 0, clients: 0 });
  };

  const handleTopListsRangeChange = (range: TimeRange) => {
    setTopListsRange(range);
    resetPages();
  };

  const handleRowsChange = (value: string) => {
    setRowsPerTable(Number(value) as RowsOption);
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
        <TopDomainsTable
          range={topListsRange}
          limit={rowsPerTable}
          page={pages.domains}
          onPageChange={(page) =>
            setPages((current) => ({ ...current, domains: page }))
          }
        />
        <TopClientsTable
          range={topListsRange}
          limit={rowsPerTable}
          page={pages.clients}
          onPageChange={(page) =>
            setPages((current) => ({ ...current, clients: page }))
          }
        />
      </TopListsSection>
    </div>
  );
}
