"use client";

import { type LucideIcon } from "lucide-react";
import { type ReactNode } from "react";

import { Button } from "~/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import { FloatingCard } from "~/components/ui/floating-card";
import { Skeleton } from "~/components/ui/skeleton";
import { cn, formatCount } from "~/lib/utils";

export type TopListFilter = "all" | "blocked";

export interface TopListFilterControls {
  value: TopListFilter;
  onChange: (filter: TopListFilter) => void;
}

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

function TopListFilterToggle({ value, onChange }: TopListFilterControls) {
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
  filterControls?: TopListFilterControls;
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
  filterControls,
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
          {filterControls ? <TopListFilterToggle {...filterControls} /> : null}
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
