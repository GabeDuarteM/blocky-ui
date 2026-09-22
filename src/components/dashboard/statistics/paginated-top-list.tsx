"use client";

import type { LucideIcon } from "lucide-react";
import { PaginationControls } from "~/components/dashboard/pagination-controls";
import { CardFooter } from "~/components/ui/card";
import { cn } from "~/lib/utils";
import { TopListCard, TopListEntry, type TopListFilter } from "./top-list";

export interface PaginatedTopListItem {
  name: string;
  count: number;
  blocked: number;
  percentage: number;
}

interface PaginatedTopListProps {
  title: string;
  description: string;
  icon: LucideIcon;
  items: PaginatedTopListItem[];
  totalCount: number;
  isLoading: boolean;
  filter: TopListFilter;
  onFilterChange: (filter: TopListFilter) => void;
  page: number;
  limit: number;
  onPageChange: (page: number) => void;
}

function TopListDetails({
  item,
  filter,
}: {
  item: PaginatedTopListItem;
  filter: TopListFilter;
}) {
  const isBlockedFilter = filter === "blocked";
  const blockedPercentage =
    item.count > 0 ? (item.blocked / item.count) * 100 : 0;

  return (
    <div className="space-y-3">
      <p className="truncate font-medium font-mono text-sm" title={item.name}>
        {item.name}
      </p>
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div
              className={cn(
                "h-2 w-2 rounded-full",
                isBlockedFilter
                  ? "bg-[var(--chart-5-muted)]"
                  : "bg-[var(--chart-1)]/75",
              )}
            />
            <span className="text-muted-foreground text-sm">
              {isBlockedFilter ? "Blocked" : "Total"}
            </span>
          </div>
          <span className="font-medium tabular-nums">
            {item.count.toLocaleString()} ({item.percentage.toFixed(1)}%)
          </span>
        </div>
        {!isBlockedFilter && item.blocked > 0 ? (
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="h-2 w-2 rounded-full bg-[var(--chart-5-muted)]" />
              <span className="text-muted-foreground text-sm">Blocked</span>
            </div>
            <span className="font-medium tabular-nums">
              {item.blocked.toLocaleString()} ({blockedPercentage.toFixed(1)}%)
            </span>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function TopListBar({
  item,
  maxCount,
  filter,
}: {
  item: PaginatedTopListItem;
  maxCount: number;
  filter: TopListFilter;
}) {
  const width = maxCount > 0 ? (item.count / maxCount) * 100 : 0;
  const blockedPercentage =
    item.count > 0 ? (item.blocked / item.count) * 100 : 0;

  if (filter === "blocked") {
    return (
      <div className="flex h-2 w-full overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full bg-[var(--chart-5-muted)] transition-all duration-300"
          style={{ width: `${width}%` }}
        />
      </div>
    );
  }

  return (
    <div className="flex h-2 w-full overflow-hidden rounded-full bg-muted">
      <div
        className="h-full rounded-l-full bg-[var(--chart-1)]/75 transition-all duration-300"
        style={{ width: `${width * (1 - blockedPercentage / 100)}%` }}
      />
      {item.blocked > 0 ? (
        <div
          className="h-full rounded-r-full bg-[var(--chart-5-muted)] transition-all duration-300"
          style={{ width: `${width * (blockedPercentage / 100)}%` }}
        />
      ) : null}
    </div>
  );
}

function TopListPagination({
  title,
  page,
  limit,
  totalCount,
  onPageChange,
}: Pick<
  PaginatedTopListProps,
  "title" | "page" | "limit" | "totalCount" | "onPageChange"
>) {
  const totalPages = Math.ceil(totalCount / limit);
  if (totalPages <= 1) {
    return null;
  }

  return (
    <CardFooter className="flex-wrap justify-between gap-3 border-t pt-4">
      <span className="shrink-0 text-muted-foreground text-sm tabular-nums">
        {(page * limit + 1).toLocaleString()}-
        {Math.min((page + 1) * limit, totalCount).toLocaleString()} of{" "}
        {totalCount.toLocaleString()}
      </span>
      <PaginationControls
        label={`${title} pagination`}
        pageIndex={page}
        pageCount={totalPages}
        hasNextPage={page < totalPages - 1}
        onPageChange={onPageChange}
      />
    </CardFooter>
  );
}

export function PaginatedTopList({
  title,
  description,
  icon,
  items,
  totalCount,
  isLoading,
  filter,
  onFilterChange,
  page,
  limit,
  onPageChange,
}: PaginatedTopListProps) {
  const maxCount = items[0]?.count ?? 0;

  return (
    <TopListCard
      title={title}
      description={description}
      icon={icon}
      filterControls={{ value: filter, onChange: onFilterChange }}
      isLoading={isLoading}
      isEmpty={items.length === 0}
      skeletonRows={limit}
      footer={
        <TopListPagination
          title={title}
          page={page}
          limit={limit}
          totalCount={totalCount}
          onPageChange={onPageChange}
        />
      }
    >
      <div className="-my-1.5">
        {items.map((item) => (
          <TopListEntry
            key={item.name}
            name={item.name}
            count={item.count}
            details={<TopListDetails item={item} filter={filter} />}
          >
            <TopListBar item={item} maxCount={maxCount} filter={filter} />
          </TopListEntry>
        ))}
      </div>
    </TopListCard>
  );
}
