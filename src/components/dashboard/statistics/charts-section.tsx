"use client";

import { useState } from "react";
import { QueriesOverTimeChart } from "./queries-over-time-chart";
import { TopDomainsTable } from "./top-domains-table";
import { TopClientsTable } from "./top-clients-table";
import { type TimeRange } from "~/lib/constants";

export function ChartsSection() {
  const [range, setRange] = useState<TimeRange>("24h");

  return (
    <div className="space-y-6">
      <QueriesOverTimeChart range={range} onRangeChange={setRange} />
      <div className="grid gap-6 md:grid-cols-2">
        <TopDomainsTable range={range} />
        <TopClientsTable range={range} />
      </div>
    </div>
  );
}
