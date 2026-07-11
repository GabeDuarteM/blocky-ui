"use client";

import { useState } from "react";
import { Users } from "lucide-react";

import { usePrefetchAdjacentPages } from "~/hooks/use-prefetch-adjacent-pages";
import { type TimeRange } from "~/lib/constants";
import { api } from "~/trpc/react";
import {
  TopListBar,
  TopListCard,
  TopListDetails,
  TopListEntry,
  type TopListFilter,
  TopListPagination,
} from "./top-list";

interface TopClientsTableProps {
  range: TimeRange;
  limit: number;
  page: number;
  onPageChange: (page: number) => void;
}

export function TopClientsTable({
  range,
  limit,
  page,
  onPageChange,
}: TopClientsTableProps) {
  const [filter, setFilter] = useState<TopListFilter>("all");
  const { data, isFetching, isLoading, isPlaceholderData } =
    api.stats.topClients.useQuery(
      {
        range,
        limit,
        offset: page * limit,
        filter,
      },
      { placeholderData: (previous) => previous },
    );
  const utils = api.useUtils();
  const items = data?.items ?? [];
  const totalCount = data?.totalCount ?? 0;
  const totalPages = Math.ceil(totalCount / limit);
  const maxTotal = items[0]?.total ?? 0;

  usePrefetchAdjacentPages({
    enabled: !isFetching && data !== undefined,
    currentPage: page,
    totalPages,
    prefetchPage: (targetPage) => {
      void utils.stats.topClients.prefetch({
        range,
        limit,
        offset: targetPage * limit,
        filter,
      });
    },
  });

  const handleFilterChange = (nextFilter: TopListFilter) => {
    setFilter(nextFilter);
    onPageChange(0);
  };

  return (
    <TopListCard
      title="Top Clients"
      description="Devices with the most DNS queries"
      icon={Users}
      filter={filter}
      onFilterChange={handleFilterChange}
      isLoading={isLoading || isPlaceholderData}
      isEmpty={items.length === 0}
      skeletonRows={limit}
      footer={
        <TopListPagination
          page={page}
          limit={limit}
          totalCount={totalCount}
          onPageChange={onPageChange}
        />
      }
    >
      <div className="-my-1.5">
        {items.map((entry) => {
          const barWidth = maxTotal > 0 ? (entry.total / maxTotal) * 100 : 0;
          const blockedPercentage =
            entry.total > 0 ? (entry.blocked / entry.total) * 100 : 0;

          return (
            <TopListEntry
              key={entry.client}
              name={entry.client}
              count={entry.total}
              details={
                <TopListDetails
                  name={entry.client}
                  count={entry.total}
                  percentage={entry.percentage}
                  blocked={entry.blocked}
                  blockedPercentage={blockedPercentage}
                  filter={filter}
                />
              }
            >
              <TopListBar
                width={barWidth}
                blocked={entry.blocked}
                blockedPercentage={blockedPercentage}
                filter={filter}
              />
            </TopListEntry>
          );
        })}
      </div>
    </TopListCard>
  );
}
