"use client";

import { useState } from "react";
import { Globe } from "lucide-react";

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

interface TopDomainsTableProps {
  range: TimeRange;
  limit: number;
  page: number;
  onPageChange: (page: number) => void;
}

export function TopDomainsTable({
  range,
  limit,
  page,
  onPageChange,
}: TopDomainsTableProps) {
  const [filter, setFilter] = useState<TopListFilter>("all");
  const { data, isFetching, isLoading, isPlaceholderData } =
    api.stats.topDomains.useQuery(
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
  const maxCount = items[0]?.count ?? 0;

  usePrefetchAdjacentPages({
    enabled: !isFetching && data !== undefined,
    currentPage: page,
    totalPages,
    prefetchPage: (targetPage) => {
      void utils.stats.topDomains.prefetch({
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
      title="Top Domains"
      description="Most frequently queried domains"
      icon={Globe}
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
          const barWidth = maxCount > 0 ? (entry.count / maxCount) * 100 : 0;
          const blockedPercentage =
            entry.count > 0 ? (entry.blocked / entry.count) * 100 : 0;

          return (
            <TopListEntry
              key={entry.domain}
              name={entry.domain}
              count={entry.count}
              details={
                <TopListDetails
                  name={entry.domain}
                  count={entry.count}
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
