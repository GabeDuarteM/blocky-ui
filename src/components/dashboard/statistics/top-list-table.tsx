"use client";

import { useQueryClient } from "@tanstack/react-query";
import type { LucideIcon } from "lucide-react";
import { Globe, Users } from "lucide-react";
import { useCallback, useState } from "react";
import { useSelectedServers } from "~/components/dashboard/server-context";
import { useLogTopList } from "~/hooks/use-log-top-list";
import { usePrefetchAdjacentPages } from "~/hooks/use-prefetch-adjacent-pages";
import type { TimeRange } from "~/lib/constants";
import { useTRPC } from "~/trpc/react";
import { PaginatedTopList } from "./paginated-top-list";
import type { TopListFilter } from "./top-list";

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
  const trpc = useTRPC();
  const [filter, setFilter] = useState<TopListFilter>("all");
  const serverIds = useSelectedServers("view");
  const query = useLogTopList(
    { type, range, limit, offset: page * limit, filter },
    true,
    true,
  );
  const queryClient = useQueryClient();
  const totalPages = Math.ceil((query.data?.totalCount ?? 0) / limit);
  const config = TOP_LIST_CONFIG[type];

  usePrefetchAdjacentPages({
    enabled: !query.isFetching && query.data !== undefined,
    currentPage: page,
    totalPages,
    prefetchPage: (targetPage) => {
      queryClient.prefetchQuery(
        trpc.logs.topList.queryOptions({
          type,
          range,
          limit,
          offset: targetPage * limit,
          filter,
          serverIds,
        }),
      );
    },
  });

  const handleFilterChange = useCallback(
    (nextFilter: TopListFilter) => {
      setFilter(nextFilter);
      onPageChange(0);
    },
    [onPageChange],
  );

  return (
    <PaginatedTopList
      title={config.title}
      description={config.description}
      icon={config.icon}
      items={query.data?.items ?? []}
      totalCount={query.data?.totalCount ?? 0}
      // biome-ignore lint/suspicious/noUnnecessaryConditions: Biome resolves useQuery to its initialData overload. https://github.com/biomejs/biome/issues/12345
      isLoading={query.isLoading || query.isPlaceholderData}
      filter={filter}
      onFilterChange={handleFilterChange}
      page={page}
      limit={limit}
      onPageChange={onPageChange}
    />
  );
}
