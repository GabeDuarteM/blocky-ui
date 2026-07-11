"use client";

import { type LucideIcon, ChevronLeft, ChevronRight } from "lucide-react";
import { type ReactNode } from "react";

import { Button } from "~/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import { FloatingCard } from "~/components/ui/floating-card";
import { PageNumbers } from "~/components/ui/page-numbers";
import { Skeleton } from "~/components/ui/skeleton";
import { cn, formatCount } from "~/lib/utils";

export type TopListFilter = "all" | "blocked";

interface TopListsSectionProps {
  description: string;
  icon: LucideIcon;
  controls?: ReactNode;
  children: ReactNode;
}

export function TopListsSection({
  description,
  icon: Icon,
  controls,
  children,
}: TopListsSectionProps) {
  return (
    <Card>
      <CardHeader>
        <div className="flex w-full flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <CardTitle className="flex items-center gap-2 text-base font-medium">
              <Icon className="h-5 w-5" />
              Top Lists
            </CardTitle>
            <CardDescription>{description}</CardDescription>
          </div>
          {controls}
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid gap-6 md:grid-cols-2">{children}</div>
      </CardContent>
    </Card>
  );
}

interface TopListFilterToggleProps {
  value: TopListFilter;
  onChange: (filter: TopListFilter) => void;
}

function TopListFilterToggle({ value, onChange }: TopListFilterToggleProps) {
  return (
    <div className="flex gap-1 sm:justify-end">
      <Button
        variant={value === "all" ? "default" : "outline"}
        size="sm"
        onClick={() => onChange("all")}
        className={cn(
          "h-7 px-2.5 text-xs",
          value === "all" && "border border-transparent",
        )}
      >
        All
      </Button>
      <Button
        variant={value === "blocked" ? "default" : "outline"}
        size="sm"
        onClick={() => onChange("blocked")}
        className={cn(
          "h-7 px-2.5 text-xs",
          value === "blocked" && "border border-transparent",
        )}
      >
        Blocked
      </Button>
    </div>
  );
}

interface TopListCardProps {
  title: string;
  description: string;
  icon: LucideIcon;
  filter?: TopListFilter;
  onFilterChange?: (filter: TopListFilter) => void;
  isLoading: boolean;
  isEmpty: boolean;
  skeletonRows: number;
  footer?: ReactNode;
  children: ReactNode;
}

export function TopListCard({
  title,
  description,
  icon: Icon,
  filter,
  onFilterChange,
  isLoading,
  isEmpty,
  skeletonRows,
  footer,
  children,
}: TopListCardProps) {
  let content = children;

  if (isLoading) {
    content = (
      <div className="space-y-3">
        {Array.from({ length: skeletonRows }).map((_, index) => (
          <Skeleton key={index} className="h-8 w-full" />
        ))}
      </div>
    );
  } else if (isEmpty) {
    content = (
      <p className="text-muted-foreground py-8 text-center text-sm">
        No data available
      </p>
    );
  }

  let filterToggle: ReactNode;
  if (filter && onFilterChange) {
    filterToggle = (
      <TopListFilterToggle value={filter} onChange={onFilterChange} />
    );
  }

  return (
    <Card className="bg-muted/30 flex min-w-0 flex-col border-0 shadow-none">
      <CardHeader>
        <div className="flex w-full flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <CardTitle className="flex items-center gap-2 text-base font-medium">
              <Icon className="h-5 w-5" />
              {title}
            </CardTitle>
            <CardDescription>{description}</CardDescription>
          </div>
          {filterToggle}
        </div>
      </CardHeader>
      <CardContent className="flex-1">{content}</CardContent>
      {footer}
    </Card>
  );
}

interface TopListEntryProps {
  name: string;
  count: number;
  details: ReactNode;
  children: ReactNode;
}

export function TopListEntry({
  name,
  count,
  details,
  children,
}: TopListEntryProps) {
  return (
    <FloatingCard content={details}>
      <div className="cursor-default space-y-1 py-1.5">
        <div className="flex items-center justify-between gap-2">
          <span className="truncate font-mono text-sm">{name}</span>
          <span className="text-muted-foreground shrink-0 text-sm tabular-nums">
            {formatCount(count)}
          </span>
        </div>
        {children}
      </div>
    </FloatingCard>
  );
}

interface TopListDetailsProps {
  name: string;
  count: number;
  percentage: number;
  blocked: number;
  blockedPercentage: number;
  filter: TopListFilter;
}

export function TopListDetails({
  name,
  count,
  percentage,
  blocked,
  blockedPercentage,
  filter,
}: TopListDetailsProps) {
  const isBlockedFilter = filter === "blocked";

  return (
    <div className="space-y-3">
      <p className="truncate font-mono text-sm font-medium" title={name}>
        {name}
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
            {count.toLocaleString()} ({percentage.toFixed(1)}%)
          </span>
        </div>
        {!isBlockedFilter && blocked > 0 && (
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="h-2 w-2 rounded-full bg-[var(--chart-5-muted)]" />
              <span className="text-muted-foreground text-sm">Blocked</span>
            </div>
            <span className="font-medium tabular-nums">
              {blocked.toLocaleString()} ({blockedPercentage.toFixed(1)}%)
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

interface TopListBarProps {
  width: number;
  blockedPercentage: number;
  blocked: number;
  filter: TopListFilter;
}

export function TopListBar({
  width,
  blockedPercentage,
  blocked,
  filter,
}: TopListBarProps) {
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
      {blocked > 0 && (
        <div
          className="h-full rounded-r-full bg-[var(--chart-5-muted)] transition-all duration-300"
          style={{ width: `${width * (blockedPercentage / 100)}%` }}
        />
      )}
    </div>
  );
}

interface TopListPaginationProps {
  page: number;
  limit: number;
  totalCount: number;
  onPageChange: (page: number) => void;
}

export function TopListPagination({
  page,
  limit,
  totalCount,
  onPageChange,
}: TopListPaginationProps) {
  const totalPages = Math.ceil(totalCount / limit);
  if (totalPages <= 1) {
    return null;
  }

  return (
    <CardFooter className="justify-between border-t pt-4">
      <span className="text-muted-foreground text-xs tabular-nums">
        {page * limit + 1}-{Math.min((page + 1) * limit, totalCount)} of{" "}
        {totalCount}
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
