import { useLogDiagnostics } from "~/hooks/use-log-diagnostics";
import { useDashboardServers } from "~/components/dashboard/server-context";
import { useLogTopList } from "~/hooks/use-log-top-list";
import { api } from "~/trpc/react";
import { type TimeRange } from "~/lib/constants";
import { useDebounce } from "~/hooks/use-debounce";

export type FilterValue =
  { type: "domain"; value: string } | { type: "client"; value: string } | null;

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
}

export function useFilterSuggestions(
  search: string,
  range: TimeRange = "24h",
): FilterSuggestions {
  const dashboard = useDashboardServers();
  const serverIds = dashboard.selection.selected("view");
  const debouncedSearch = useDebounce(search, 300);
  const hasSearch = debouncedSearch.length > 0;

  const { data: topDomains } = useLogTopList(
    { type: "domains", range, limit: 5, offset: 0, filter: "all" },
    !hasSearch,
  );

  const { data: topClients } = useLogTopList(
    { type: "clients", range, limit: 5, offset: 0, filter: "all" },
    !hasSearch,
  );

  const searched = api.logs.search.useQuery(
    { serverIds, type: "domains", range, query: debouncedSearch, limit: 10 },
    { enabled: hasSearch },
  );
  const searchedClient = api.logs.search.useQuery(
    { serverIds, type: "clients", range, query: debouncedSearch, limit: 10 },
    { enabled: hasSearch },
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

  return { domains, clients };
}

export function formatCount(count: number): string {
  if (count >= 1000) {
    return `${(count / 1000).toFixed(1)}K`;
  }
  return count.toString();
}
