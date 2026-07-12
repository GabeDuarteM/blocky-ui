"use client";

import { useState } from "react";
import { Globe, Users, type LucideIcon } from "lucide-react";

import { usePrefetchAdjacentPages } from "~/hooks/use-prefetch-adjacent-pages";
import { type TimeRange } from "~/lib/constants";
import { api } from "~/trpc/react";
import { PaginatedTopList } from "./paginated-top-list";
import { type TopListFilter } from "./top-list";

type TopListType = "domains" | "clients";

const TOP_LIST_CONFIG: Record<
  TopListType,
  { title: string; description: string; icon: LucideIcon }
> = {
  domains: {
    title: "Top Domains",
    description: "Most frequently queried domains",
    icon: Globe,
  },
  clients: {
    title: "Top Clients",
    description: "Devices with the most DNS queries",
    icon: Users,
  },
};

interface TopListTableProps {
  type: TopListType;
  range: TimeRange;
  limit: number;
  page: number;
  onPageChange: (page: number) => void;
}

export function TopListTable({
  type,
  range,
  limit,
  page,
  onPageChange,
}: TopListTableProps) {
  const [filter, setFilter] = useState<TopListFilter>("all");
  const query = api.stats.topList.useQuery(
    { type, range, limit, offset: page * limit, filter },
    { placeholderData: (previous) => previous },
  );
  const utils = api.useUtils();
  const totalPages = Math.ceil((query.data?.totalCount ?? 0) / limit);
  const config = TOP_LIST_CONFIG[type];

  usePrefetchAdjacentPages({
    enabled: !query.isFetching && query.data !== undefined,
    currentPage: page,
    totalPages,
    prefetchPage: (targetPage) => {
      void utils.stats.topList.prefetch({
        type,
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
    <PaginatedTopList
      title={config.title}
      description={config.description}
      icon={config.icon}
      items={query.data?.items ?? []}
      totalCount={query.data?.totalCount ?? 0}
      isLoading={query.isLoading || query.isPlaceholderData}
      filter={filter}
      onFilterChange={handleFilterChange}
      page={page}
      limit={limit}
      onPageChange={onPageChange}
    />
  );
}
