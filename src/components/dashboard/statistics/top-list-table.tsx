"use client";

import { useState } from "react";
import { Globe, Users, type LucideIcon } from "lucide-react";

import { Switch } from "~/components/ui/switch";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "~/components/ui/tooltip";
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
  // Defaults to hiding. Applies to both the all and blocked views, because it is
  // the same query with a different filter.
  const [hideLocalDiscovery, setHideLocalDiscovery] = useState(true);
  const { data: features, isPending: featuresPending } =
    api.blocky.features.useQuery(undefined, { retry: false });
  const showLocalDiscoveryToggle =
    type === "domains" && Boolean(features?.localDiscoveryFilter);
  const localDiscoveryInput = showLocalDiscoveryToggle
    ? hideLocalDiscovery
    : undefined;

  const query = api.stats.topList.useQuery(
    {
      type,
      range,
      limit,
      offset: page * limit,
      filter,
      hideLocalDiscovery: localDiscoveryInput,
    },
    {
      // Without this the first render queries unfiltered, then refetches once the
      // feature flag arrives -- a visible flash of the rows the switch hides.
      enabled: !featuresPending,
      placeholderData: (previous) => previous,
    },
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
        hideLocalDiscovery: localDiscoveryInput,
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
      headerExtra={
        showLocalDiscoveryToggle ? (
          <Tooltip disableHoverableContent>
            {/* The trigger is the Switch itself, not a wrapper. A span is not
                focusable, so the tooltip would never open from the keyboard --
                and this control has no visible label, so the tooltip is the only
                description of what it does. */}
            <TooltipTrigger asChild>
              <Switch
                id="top-domains-hide-local-discovery"
                aria-label="Hide local service-discovery domains"
                checked={hideLocalDiscovery}
                onCheckedChange={(next) => {
                  setHideLocalDiscovery(next);
                  onPageChange(0);
                }}
              />
            </TooltipTrigger>
            <TooltipContent sideOffset={4}>
              Hide local service-discovery and special-use names (.arpa,
              .localhost, .localdomain, DNS-SD)
            </TooltipContent>
          </Tooltip>
        ) : null
      }
      page={page}
      limit={limit}
      onPageChange={onPageChange}
    />
  );
}
