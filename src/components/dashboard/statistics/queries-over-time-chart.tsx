"use client";

import { format } from "date-fns";
import { BarChart3 } from "lucide-react";
import { type ReactNode, useCallback, useId, useMemo, useState } from "react";
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { useDashboardServers } from "~/components/dashboard/server-context";
import { Button } from "~/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import {
  type ChartConfig,
  ChartContainer,
  ChartLegend,
  ChartTooltip,
  ChartTooltipContent,
} from "~/components/ui/chart";
import { useLogDiagnostics } from "~/hooks/use-log-diagnostics";
import type { TimeRange } from "~/lib/constants";
import { cn } from "~/lib/utils";
import { api } from "~/trpc/react";
import {
  ActiveFilterChip,
  type ChartFilter,
  ChartFilterCombobox,
} from "./chart-filter-combobox";
import { TimeRangeSelector } from "./time-range-selector";

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
const SKELETON_GRID_LINES = [32, 86, 140, 194] as const;
const SKELETON_AXIS_LABELS = [
  { x: 18, y: 28, width: 18 },
  { x: 14, y: 82, width: 22 },
  { x: 18, y: 136, width: 18 },
  { x: 22, y: 190, width: 14 },
] as const;
const SKELETON_TIME_LABELS = [72, 220, 368, 516, 664] as const;
const SKELETON_LEGEND_ITEMS = [
  { key: "total", color: "var(--chart-1)", width: "w-9" },
  { key: "blocked", color: "var(--chart-5-muted)", width: "w-12" },
  { key: "cached", color: "var(--chart-2)", width: "w-11" },
] as const;

interface InteractiveLegendProps {
  series: SeriesKey[];
  visibleSeries: Set<SeriesKey>;
  onToggle: (key: SeriesKey) => void;
}

function InteractiveLegend({
  series,
  visibleSeries,
  onToggle,
}: InteractiveLegendProps) {
  const options = useMemo(
    () => series.map((key) => ({ key, onClick: () => onToggle(key) })),
    [series, onToggle],
  );
  return (
    <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2 pt-3">
      {options.map(({ key, onClick }) => {
        const config = chartConfig[key];
        const isVisible = visibleSeries.has(key);
        return (
          <Button
            key={key}
            variant="ghost"
            size="sm"
            onClick={onClick}
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

function ChartSkeleton() {
  const rawSheenId = useId();
  const sheenId = `chart-loading-sheen-${rawSheenId.replaceAll(":", "")}`;

  return (
    <div
      className="relative h-[220px] w-full text-muted-foreground sm:h-[250px]"
      aria-hidden="true"
    >
      <svg
        aria-hidden="true"
        className="h-full w-full"
        fill="none"
        preserveAspectRatio="none"
        viewBox="0 0 800 250"
      >
        <defs>
          <linearGradient id={sheenId} x1="-120" x2="120" y1="0" y2="0">
            <stop offset="0" stopColor="currentColor" stopOpacity="0" />
            <stop offset="0.5" stopColor="currentColor" stopOpacity="0.22" />
            <stop offset="1" stopColor="currentColor" stopOpacity="0" />
            <animateTransform
              attributeName="gradientTransform"
              dur="1.4s"
              from="-180 0"
              repeatCount="indefinite"
              to="900 0"
              type="translate"
            />
          </linearGradient>
        </defs>
        {SKELETON_AXIS_LABELS.map((label) => (
          <rect
            key={`${label.x}-${label.y}`}
            x={label.x}
            y={label.y}
            width={label.width}
            height="8"
            rx="4"
            fill="currentColor"
            fillOpacity="0.18"
          />
        ))}
        {SKELETON_GRID_LINES.map((y) => (
          <line
            key={y}
            x1="48"
            y1={y}
            x2="790"
            y2={y}
            stroke="currentColor"
            strokeDasharray="3 5"
            strokeOpacity="0.14"
          />
        ))}
        <rect
          x="48"
          y="16"
          width="742"
          height="196"
          rx="6"
          fill={`url(#${sheenId})`}
        />
        {SKELETON_TIME_LABELS.map((x) => (
          <rect
            key={x}
            x={x}
            y="224"
            width="34"
            height="8"
            rx="4"
            fill="currentColor"
            fillOpacity="0.18"
          />
        ))}
      </svg>
      <div className="absolute right-0 bottom-0 left-0 flex items-center justify-center gap-4">
        {SKELETON_LEGEND_ITEMS.map((item) => (
          <div key={item.key} className="flex items-center gap-1.5">
            <div
              className="h-2 w-2 shrink-0 rounded-[2px]"
              style={{ backgroundColor: item.color }}
            />
            <div
              className={cn("h-2 rounded bg-muted-foreground/25", item.width)}
            />
          </div>
        ))}
      </div>
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
  const [filter, setFilter] = useState<ChartFilter>(null);

  const dashboard = useDashboardServers();
  const options = {
    range,
    domain: filter?.type === "domain" ? filter.value : undefined,
    client: filter?.type === "client" ? filter.value : undefined,
  };
  const connected = api.logs.queriesOverTime.useQuery({
    ...options,
    serverIds: dashboard.selection.selected("view"),
  });
  const { isLoading, isPlaceholderData } = connected;
  const data = connected.data?.items;
  useLogDiagnostics("chart", connected.data?.diagnostics);
  const showLoading = isLoading || isPlaceholderData;

  const clearFilter = useCallback(() => setFilter(null), []);
  return (
    <TrafficChart
      range={range}
      data={data}
      isLoading={showLoading}
      controls={
        <>
          <ChartFilterCombobox
            value={filter}
            onChange={setFilter}
            range={range}
          />
          <TimeRangeSelector value={range} onChange={onRangeChange} />
        </>
      }
      activeFilter={
        filter ? (
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground text-xs">Showing:</span>
            <ActiveFilterChip filter={filter} onClear={clearFilter} />
          </div>
        ) : undefined
      }
    />
  );
}

export function TrafficChart({
  range,
  data,
  isLoading,
  series = SERIES_KEYS,
  controls,
  activeFilter,
}: {
  range: TimeRange;
  data:
    | { time: string; total: number; blocked: number; cached?: number }[]
    | undefined;
  isLoading: boolean;
  series?: SeriesKey[];
  controls?: ReactNode;
  activeFilter?: ReactNode;
}) {
  const [visibleSeries, setVisibleSeries] = useState<Set<SeriesKey>>(
    () => new Set(series),
  );

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

  const formatXAxisTick = useCallback(
    (value: string) =>
      format(new Date(value), timeRangeConfig[range].axisFormat),
    [range],
  );

  const formatTooltipLabel = useCallback(
    (value: ReactNode, payload: readonly { payload?: { time?: string } }[]) => {
      const { time } = payload[0]?.payload ?? {};
      if (!time) {
        return value;
      }
      return format(new Date(time), timeRangeConfig[range].tooltipFormat);
    },
    [range],
  );

  const formatYAxisTick = useCallback((value: number) => {
    if (value >= 1_000_000) {
      return `${(value / 1_000_000).toFixed(1)}M`;
    }
    if (value >= 1000) {
      return `${(value / 1000).toFixed(0)}K`;
    }
    return value.toString();
  }, []);
  function renderChart() {
    if (isLoading) {
      return <ChartSkeleton />;
    }
    if (data?.length === 0) {
      return (
        <div className="flex h-[220px] items-center justify-center text-muted-foreground text-sm sm:h-[250px]">
          No queries recorded yet.
        </div>
      );
    }
    return (
      <ChartContainer
        config={chartConfig}
        className="h-[220px] min-h-[220px] w-full min-w-0 sm:h-[250px]"
      >
        <AreaChart
          data={data ?? []}
          margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
        >
          <CartesianGrid strokeDasharray="3 3" vertical={false} />
          <XAxis
            dataKey="time"
            tickFormatter={formatXAxisTick}
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
            tickFormatter={formatYAxisTick}
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
                series={series}
                visibleSeries={visibleSeries}
                onToggle={handleToggle}
              />
            }
          />
          {series
            .filter((key) => visibleSeries.has(key))
            .map((key) => (
              <Area
                key={key}
                type="monotone"
                dataKey={key}
                stroke={`var(--color-${key})`}
                fill={`var(--color-${key})`}
                fillOpacity={0.2}
                strokeWidth={2}
              />
            ))}
        </AreaChart>
      </ChartContainer>
    );
  }
  return (
    <Card>
      <CardHeader>
        <div className="flex w-full flex-col gap-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex min-w-0 flex-1 flex-col gap-1">
              <CardTitle className="flex items-center gap-2 font-medium text-base">
                <BarChart3 className="h-5 w-5" />
                Queries over time
              </CardTitle>
              <CardDescription>
                DNS query volume and blocking activity
              </CardDescription>
            </div>
            {controls ? (
              <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto sm:justify-end">
                {controls}
              </div>
            ) : null}
          </div>
          {activeFilter}
        </div>
      </CardHeader>
      <CardContent className="min-w-0">{renderChart()}</CardContent>
    </Card>
  );
}
