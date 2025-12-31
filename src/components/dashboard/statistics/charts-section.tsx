"use client";

import { useState } from "react";
import { QueriesOverTimeChart } from "./queries-over-time-chart";
import { TopDomainsTable } from "./top-domains-table";
import { TopClientsTable } from "./top-clients-table";
import { type TimeRange } from "~/lib/constants";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
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
  const [range, setRange] = useState<TimeRange>("24h");
  const [rowsPerTable, setRowsPerTable] = useState<RowsOption>(5);

  return (
    <div className="space-y-6">
      <QueriesOverTimeChart range={range} onRangeChange={setRange} />
      <Card>
        <CardHeader>
          <div className="flex w-full flex-row items-center justify-between">
            <div className="flex min-w-0 flex-1 flex-col gap-1">
              <CardTitle className="flex items-center gap-2 text-base font-medium">
                <ListOrdered className="h-5 w-5" />
                Top Lists
              </CardTitle>
              <CardDescription>Most active domains and clients</CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground text-xs">Rows</span>
              <Select
                value={String(rowsPerTable)}
                onValueChange={(v) => setRowsPerTable(Number(v) as RowsOption)}
              >
                <SelectTrigger size="sm" className="h-7 w-18 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ROWS_OPTIONS.map((opt) => (
                    <SelectItem key={opt} value={String(opt)}>
                      {opt}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid gap-6 md:grid-cols-2">
            <TopDomainsTable range={range} limit={rowsPerTable} />
            <TopClientsTable range={range} limit={rowsPerTable} />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
