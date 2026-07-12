"use client";

import { ChevronLeft, ChevronRight, type LucideIcon } from "lucide-react";

import { Button } from "~/components/ui/button";
import { CardFooter } from "~/components/ui/card";
import { PageNumbers } from "~/components/ui/page-numbers";
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
      <p className="truncate font-mono text-sm font-medium" title={item.name}>
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
        {!isBlockedFilter && item.blocked > 0 && (
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="h-2 w-2 rounded-full bg-[var(--chart-5-muted)]" />
              <span className="text-muted-foreground text-sm">Blocked</span>
            </div>
            <span className="font-medium tabular-nums">
              {item.blocked.toLocaleString()} ({blockedPercentage.toFixed(1)}%)
            </span>
          </div>
        )}
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
      <div className="bg-muted flex h-2 w-full overflow-hidden rounded-full">
        <div
          className="h-full rounded-full bg-[var(--chart-5-muted)] transition-all duration-300"
          style={{ width: `${width}%` }}
        />
      </div>
    );
  }

  return (
    <div className="bg-muted flex h-2 w-full overflow-hidden rounded-full">
      <div
        className="h-full rounded-l-full bg-[var(--chart-1)]/75 transition-all duration-300"
        style={{ width: `${width * (1 - blockedPercentage / 100)}%` }}
      />
      {item.blocked > 0 && (
        <div
          className="h-full rounded-r-full bg-[var(--chart-5-muted)] transition-all duration-300"
          style={{ width: `${width * (blockedPercentage / 100)}%` }}
        />
      )}
    </div>
  );
}

function TopListPagination({
  page,
  limit,
  totalCount,
  onPageChange,
}: Pick<
  PaginatedTopListProps,
  "page" | "limit" | "totalCount" | "onPageChange"
>) {
  const totalPages = Math.ceil(totalCount / limit);
  if (totalPages <= 1) {
    return null;
  }

  return (
    <CardFooter className="justify-between border-t pt-4">
      <span className="text-muted-foreground text-xs tabular-nums">
        {(page * limit + 1).toLocaleString()}-
        {Math.min((page + 1) * limit, totalCount).toLocaleString()} of{" "}
        {totalCount.toLocaleString()}
      </span>
      <div className="flex gap-1">
        <Button
          variant="outline"
          size="icon"
          className="h-7 w-7"
          onClick={() => onPageChange(page - 1)}
          disabled={page === 0}
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <PageNumbers
          currentPage={page}
          totalPages={totalPages}
          onPageChange={onPageChange}
        />
        <Button
          variant="outline"
          size="icon"
          className="h-7 w-7"
          onClick={() => onPageChange(page + 1)}
          disabled={page >= totalPages - 1}
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
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
