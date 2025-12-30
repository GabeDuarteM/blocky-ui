"use client";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import { Users } from "lucide-react";
import { Skeleton } from "~/components/ui/skeleton";
import { FloatingCard } from "~/components/ui/floating-card";
import { api } from "~/trpc/react";
import { type TimeRange } from "~/lib/constants";
import { formatCount } from "~/lib/utils";

interface TopClientsTableProps {
  range: TimeRange;
}

export function TopClientsTable({ range }: TopClientsTableProps) {
  const { data, isLoading } = api.stats.topClients.useQuery({
    range,
    limit: 5,
  });

  const maxTotal = data?.[0]?.total ?? 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base font-medium">
          <Users className="h-5 w-5" />
          Top Clients
        </CardTitle>
        <CardDescription>Devices with the most DNS queries</CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-8 w-full" />
            ))}
          </div>
        ) : data?.length === 0 ? (
          <p className="text-muted-foreground py-8 text-center text-sm">
            No data available
          </p>
        ) : (
          <div className="-my-1.5">
            {data?.map((entry) => {
              const totalWidth =
                maxTotal > 0 ? (entry.total / maxTotal) * 100 : 0;
              const blockedPercentage =
                entry.total > 0 ? (entry.blocked / entry.total) * 100 : 0;
              return (
                <FloatingCard
                  key={entry.client}
                  content={
                    <div className="space-y-3">
                      <p
                        className="truncate font-mono text-sm font-medium"
                        title={entry.client}
                      >
                        {entry.client}
                      </p>
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <div className="h-2 w-2 rounded-full bg-[var(--chart-1)]/75" />
                            <span className="text-muted-foreground text-sm">
                              Total
                            </span>
                          </div>
                          <span className="font-medium tabular-nums">
                            {entry.total.toLocaleString()} (
                            {entry.percentage.toFixed(1)}%)
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <div className="h-2 w-2 rounded-full bg-[var(--chart-5-muted)]" />
                            <span className="text-muted-foreground text-sm">
                              Blocked
                            </span>
                          </div>
                          <span className="font-medium tabular-nums">
                            {entry.blocked.toLocaleString()} (
                            {blockedPercentage.toFixed(1)}%)
                          </span>
                        </div>
                      </div>
                    </div>
                  }
                >
                  <div className="cursor-default space-y-1 py-1.5">
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate font-mono text-sm">
                        {entry.client}
                      </span>
                      <span className="text-muted-foreground shrink-0 text-sm tabular-nums">
                        {formatCount(entry.total)}
                      </span>
                    </div>
                    <div className="bg-muted flex h-2 w-full overflow-hidden rounded-full">
                      <div
                        className="h-full rounded-l-full bg-[var(--chart-1)]/75 transition-all duration-300"
                        style={{
                          width: `${totalWidth * (1 - blockedPercentage / 100)}%`,
                        }}
                      />
                      {entry.blocked > 0 && (
                        <div
                          className="h-full rounded-r-full bg-[var(--chart-5-muted)] transition-all duration-300"
                          style={{
                            width: `${totalWidth * (blockedPercentage / 100)}%`,
                          }}
                        />
                      )}
                    </div>
                  </div>
                </FloatingCard>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
