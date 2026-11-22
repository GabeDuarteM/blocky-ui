import { useQuery } from "@tanstack/react-query";
import { useSelectedServers } from "~/components/dashboard/server-context";
import { useDebounce } from "~/hooks/use-debounce";
import { useLogDiagnostics } from "~/hooks/use-log-diagnostics";
import { useLogTopList } from "~/hooks/use-log-top-list";
import type { TimeRange } from "~/lib/constants";
import { useTRPC } from "~/trpc/react";

export type FilterValue =
  | { type: "domain"; value: string }
  | { type: "client"; value: string }
  | null;

interface DomainSuggestion {
  domain: string;
  count: number;
}

interface ClientSuggestion {
  client: string;
  count: number;
}

export interface FilterSuggestions {
  domains: DomainSuggestion[];
  clients: ClientSuggestion[];
  isLoading: boolean;
}

export function useFilterSuggestions(
  search: string,
  range: TimeRange = "24h",
): FilterSuggestions {
  const trpc = useTRPC();
  const serverIds = useSelectedServers("view");
  const debouncedSearch = useDebounce(search, 300);
  const hasSearch = debouncedSearch.length > 0;

  const { data: topDomains, isLoading: loadingTopDomains } = useLogTopList(
    { type: "domains", range, limit: 5, offset: 0, filter: "all" },
    !hasSearch,
  );

  const { data: topClients, isLoading: loadingTopClients } = useLogTopList(
    { type: "clients", range, limit: 5, offset: 0, filter: "all" },
    !hasSearch,
  );

  const searched = useQuery(
    trpc.logs.search.queryOptions(
      { serverIds, type: "domains", range, query: debouncedSearch, limit: 10 },
      { enabled: hasSearch },
    ),
  );
  const searchedClient = useQuery(
    trpc.logs.search.queryOptions(
      { serverIds, type: "clients", range, query: debouncedSearch, limit: 10 },
      { enabled: hasSearch },
    ),
  );

  useLogDiagnostics(
    "search-domains",
    hasSearch ? searched.data?.diagnostics : undefined,
  );
  useLogDiagnostics(
    "search-clients",
    hasSearch ? searchedClient.data?.diagnostics : undefined,
  );

  const domains = hasSearch
    ? (searched.data?.items.map((item) => ({
        domain: item.name,
        count: item.count,
      })) ?? [])
    : (topDomains?.items.map((item) => ({
        domain: item.name,
        count: item.count,
      })) ?? []);
  const clients = hasSearch
    ? (searchedClient.data?.items.map((item) => ({
        client: item.name,
        count: item.count,
      })) ?? [])
    : (topClients?.items.map((item) => ({
        client: item.name,
        count: item.count,
      })) ?? []);

  const isLoading =
    search !== debouncedSearch ||
    (hasSearch
      ? // biome-ignore lint/suspicious/noUnnecessaryConditions: Biome resolves useQuery to its initialData overload. https://github.com/biomejs/biome/issues/12345
        searched.isLoading || searchedClient.isLoading
      : // biome-ignore lint/suspicious/noUnnecessaryConditions: Biome resolves useQuery to its initialData overload. https://github.com/biomejs/biome/issues/12345
        loadingTopDomains || loadingTopClients);

  return { domains, clients, isLoading };
}

export function formatCount(count: number): string {
  if (count >= 1000) {
    return `${(count / 1000).toFixed(1)}K`;
  }
  return count.toString();
}
