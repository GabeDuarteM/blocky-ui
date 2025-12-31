import { api } from "~/trpc/react";
import { type TimeRange } from "~/lib/constants";
import { useDebounce } from "~/hooks/use-debounce";

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
}

export function useFilterSuggestions(
  search: string,
  range: TimeRange = "24h",
): FilterSuggestions {
  const debouncedSearch = useDebounce(search, 300);
  const hasSearch = debouncedSearch.length > 0;

  const { data: topDomains } = api.stats.topDomains.useQuery(
    { range, limit: 5, filter: "all" },
    { enabled: !hasSearch },
  );

  const { data: topClients } = api.stats.topClients.useQuery(
    { range, limit: 5, filter: "all" },
    { enabled: !hasSearch },
  );

  const { data: searchedDomains } = api.stats.searchDomains.useQuery(
    { range, query: debouncedSearch, limit: 10 },
    { enabled: hasSearch },
  );

  const { data: searchedClients } = api.stats.searchClients.useQuery(
    { range, query: debouncedSearch, limit: 10 },
    { enabled: hasSearch },
  );

  const domains = hasSearch
    ? (searchedDomains ?? [])
    : (topDomains?.items.map((d) => ({ domain: d.domain, count: d.count })) ??
      []);

  const clients = hasSearch
    ? (searchedClients ?? [])
    : (topClients?.items.map((c) => ({ client: c.client, count: c.total })) ??
      []);

  return { domains, clients };
}

export function formatCount(count: number): string {
  if (count >= 1000) {
    return `${(count / 1000).toFixed(1)}K`;
  }
  return count.toString();
}
