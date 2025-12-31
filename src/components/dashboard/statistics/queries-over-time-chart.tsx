"use client";

import { useState, useCallback, useMemo } from "react";
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { format } from "date-fns";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  type ChartConfig,
} from "~/components/ui/chart";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import { BarChart3 } from "lucide-react";
import { Button } from "~/components/ui/button";
import { Skeleton } from "~/components/ui/skeleton";
import { type TimeRange } from "~/lib/constants";
import { TimeRangeSelector } from "./time-range-selector";
import {
  ChartFilterCombobox,
  ActiveFilterChip,
  type ChartFilter,
} from "./chart-filter-combobox";
import { api } from "~/trpc/react";
import { cn } from "~/lib/utils";

const timeRangeConfig: Record<
  TimeRange,
  { axisFormat: string; tooltipFormat: string; tickInterval: number }
> = {
  "1h": { axisFormat: "HH:mm", tooltipFormat: "HH:mm", tickInterval: 1 },
  "24h": { axisFormat: "HH:mm", tooltipFormat: "HH:mm", tickInterval: 3 },
  "7d": { axisFormat: "EEE", tooltipFormat: "EEE HH:mm", tickInterval: 3 },
  "30d": { axisFormat: "MMM d", tooltipFormat: "MMM d", tickInterval: 4 },
};

const chartConfig = {
  total: {
    label: "Total",
    color: "var(--chart-1)",
  },
  blocked: {
    label: "Blocked",
    color: "var(--chart-5-muted)",
  },
  cached: {
    label: "Cached",
    color: "var(--chart-2)",
  },
} satisfies ChartConfig;

type SeriesKey = keyof typeof chartConfig;
const SERIES_KEYS: SeriesKey[] = ["total", "blocked", "cached"];

interface InteractiveLegendProps {
  visibleSeries: Set<SeriesKey>;
  onToggle: (key: SeriesKey) => void;
}

function InteractiveLegend({
  visibleSeries,
  onToggle,
}: InteractiveLegendProps) {
  return (
    <div className="flex items-center justify-center gap-4 pt-3">
      {SERIES_KEYS.map((key) => {
        const config = chartConfig[key];
        const isVisible = visibleSeries.has(key);
        return (
          <Button
            key={key}
            variant="ghost"
            size="sm"
            onClick={() => onToggle(key)}
            className={cn(
              "h-auto gap-1.5 px-1 py-0",
              !isVisible && "line-through opacity-40",
            )}
          >
            <div
              className="h-2 w-2 shrink-0 rounded-[2px]"
              style={{ backgroundColor: config.color }}
            />
            <span className="text-xs">{config.label}</span>
          </Button>
        );
      })}
    </div>
  );
}

interface QueriesOverTimeChartProps {
  range: TimeRange;
  onRangeChange: (range: TimeRange) => void;
}

export function QueriesOverTimeChart({
  range,
  onRangeChange,
}: QueriesOverTimeChartProps) {
  const [visibleSeries, setVisibleSeries] = useState<Set<SeriesKey>>(
    () => new Set(SERIES_KEYS),
  );
  const [filter, setFilter] = useState<ChartFilter>(null);

  const handleToggle = useCallback((key: SeriesKey) => {
    setVisibleSeries((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        if (next.size > 1) {
          next.delete(key);
        }
      } else {
        next.add(key);
      }
      return next;
    });
  }, []);

  const { data, isFetching } = api.stats.queriesOverTime.useQuery(
    {
      range,
      domain: filter?.type === "domain" ? filter.value : undefined,
      client: filter?.type === "client" ? filter.value : undefined,
    },
    { placeholderData: (prev) => prev },
  );

  const chartData = useMemo(
    () =>
      data?.map((entry) => ({
        ...entry,
        axisTime: format(
          new Date(entry.time),
          timeRangeConfig[range].axisFormat,
        ),
      })) ?? [],
    [data, range],
  );

  const formatTooltipLabel = useCallback(
    (value: string, payload: { payload?: { time?: string } }[]) => {
      const time = payload[0]?.payload?.time;
      if (!time) return value;
      return format(new Date(time), timeRangeConfig[range].tooltipFormat);
    },
    [range],
  );

  return (
    <Card>
      <CardHeader>
        <div className="flex w-full flex-col gap-3">
          <div className="flex flex-row items-start justify-between gap-4">
            <div className="flex min-w-0 flex-1 flex-col gap-1">
              <CardTitle className="flex items-center gap-2 text-base font-medium">
                <BarChart3 className="h-5 w-5" />
                Queries over time
              </CardTitle>
              <CardDescription>
                DNS query volume and blocking activity
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <ChartFilterCombobox
                value={filter}
                onChange={setFilter}
                range={range}
              />
              <TimeRangeSelector value={range} onChange={onRangeChange} />
            </div>
          </div>
          {filter && (
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground text-xs">Showing:</span>
              <ActiveFilterChip
                filter={filter}
                onClear={() => setFilter(null)}
              />
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {isFetching ? (
          <Skeleton className="h-[250px] w-full" />
        ) : (
          <ChartContainer config={chartConfig} className="h-[250px] w-full">
            <AreaChart
              data={chartData}
              margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
            >
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis
                dataKey="axisTime"
                tickLine={false}
                axisLine={false}
                tickMargin={8}
                fontSize={12}
                interval={timeRangeConfig[range].tickInterval}
              />
              <YAxis
                tickLine={false}
                axisLine={false}
                tickMargin={8}
                fontSize={12}
                width={50}
                tickFormatter={(value: number) => {
                  if (value >= 1000000)
                    return `${(value / 1000000).toFixed(1)}M`;
                  if (value >= 1000) return `${(value / 1000).toFixed(0)}K`;
                  return value.toString();
                }}
              />
              <ChartTooltip
                content={
                  <ChartTooltipContent
                    indicator="line"
                    labelFormatter={formatTooltipLabel}
                  />
                }
              />
              <ChartLegend
                content={
                  <InteractiveLegend
                    visibleSeries={visibleSeries}
                    onToggle={handleToggle}
                  />
                }
              />
              {visibleSeries.has("total") && (
                <Area
                  type="monotone"
                  dataKey="total"
                  stroke="var(--color-total)"
                  fill="var(--color-total)"
                  fillOpacity={0.2}
                  strokeWidth={2}
                />
              )}
              {visibleSeries.has("blocked") && (
                <Area
                  type="monotone"
                  dataKey="blocked"
                  stroke="var(--color-blocked)"
                  fill="var(--color-blocked)"
                  fillOpacity={0.2}
                  strokeWidth={2}
                />
              )}
              {visibleSeries.has("cached") && (
                <Area
                  type="monotone"
                  dataKey="cached"
                  stroke="var(--color-cached)"
                  fill="var(--color-cached)"
                  fillOpacity={0.2}
                  strokeWidth={2}
                />
              )}
            </AreaChart>
          </ChartContainer>
        )}
      </CardContent>
    </Card>
  );
}
