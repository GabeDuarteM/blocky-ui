"use client";

import { useState } from "react";
import { Check, Filter, X } from "lucide-react";
import { cn } from "~/lib/utils";
import { Button } from "~/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "~/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "~/components/ui/popover";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "~/components/ui/tooltip";
import { api } from "~/trpc/react";
import { type TimeRange } from "~/lib/constants";
import { useDebounce } from "~/hooks/use-debounce";

export type ChartFilter =
  | { type: "domain"; value: string }
  | { type: "client"; value: string }
  | null;

interface ChartFilterComboboxProps {
  value: ChartFilter;
  onChange: (value: ChartFilter) => void;
  range: TimeRange;
}

function formatCount(count: number): string {
  if (count >= 1000) {
    return `${(count / 1000).toFixed(1)}K`;
  }
  return count.toString();
}

export function ChartFilterCombobox({
  value,
  onChange,
  range,
}: ChartFilterComboboxProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
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

  const handleSelect = (type: "domain" | "client", selectedValue: string) => {
    onChange({ type, value: selectedValue });
    setOpen(false);
    setSearch("");
  };

  const handleClear = () => {
    onChange(null);
  };

  const hasFilter = value !== null;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <Tooltip>
        <TooltipTrigger asChild>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              size="icon"
              className={cn(
                "relative h-7 w-7",
                hasFilter && "border-primary/50 bg-primary/5",
              )}
              aria-label="Filter chart"
            >
              <Filter
                className={cn("h-3.5 w-3.5", hasFilter && "text-primary")}
              />
              {hasFilter && (
                <span className="bg-primary absolute -top-1 -right-1 h-2 w-2 rounded-full" />
              )}
            </Button>
          </PopoverTrigger>
        </TooltipTrigger>
        <TooltipContent side="bottom">
          <p>Filter by domain or client</p>
        </TooltipContent>
      </Tooltip>
      <PopoverContent className="w-[300px] p-0" align="end">
        <Command shouldFilter={false}>
          <CommandInput
            placeholder="Search domains or clients..."
            value={search}
            onValueChange={setSearch}
          />
          <CommandList>
            <CommandEmpty>No results found.</CommandEmpty>
            {domains.length > 0 && (
              <CommandGroup heading="Domains">
                {domains.map((domain) => (
                  <CommandItem
                    key={`domain:${domain.domain}`}
                    value={`domain:${domain.domain}`}
                    onSelect={() => handleSelect("domain", domain.domain)}
                  >
                    <Check
                      className={cn(
                        "mr-2 h-4 w-4",
                        value?.type === "domain" &&
                          value.value === domain.domain
                          ? "opacity-100"
                          : "opacity-0",
                      )}
                    />
                    <span className="flex-1 truncate">{domain.domain}</span>
                    <span className="text-muted-foreground ml-2 text-xs">
                      {formatCount(domain.count)}
                    </span>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
            {clients.length > 0 && (
              <CommandGroup heading="Clients">
                {clients.map((client) => (
                  <CommandItem
                    key={`client:${client.client}`}
                    value={`client:${client.client}`}
                    onSelect={() => handleSelect("client", client.client)}
                  >
                    <Check
                      className={cn(
                        "mr-2 h-4 w-4",
                        value?.type === "client" &&
                          value.value === client.client
                          ? "opacity-100"
                          : "opacity-0",
                      )}
                    />
                    <span className="flex-1 truncate">{client.client}</span>
                    <span className="text-muted-foreground ml-2 text-xs">
                      {formatCount(client.count)}
                    </span>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
          </CommandList>
          {hasFilter && (
            <div className="border-t p-2">
              <Button
                variant="ghost"
                size="sm"
                className="h-7 w-full justify-start text-xs"
                onClick={handleClear}
              >
                <X className="mr-2 h-3.5 w-3.5" />
                Clear filter
              </Button>
            </div>
          )}
        </Command>
      </PopoverContent>
    </Popover>
  );
}

interface ActiveFilterChipProps {
  filter: ChartFilter;
  onClear: () => void;
}

export function ActiveFilterChip({ filter, onClear }: ActiveFilterChipProps) {
  if (!filter) return null;

  const typeLabel = filter.type === "domain" ? "Domain" : "Client";

  return (
    <div className="bg-primary/10 text-primary inline-flex items-center gap-1.5 rounded-full py-0.5 pr-1 pl-2.5 text-xs font-medium">
      <span className="max-w-[150px] truncate">
        {typeLabel}: {filter.value}
      </span>
      <button
        onClick={onClear}
        className="hover:bg-primary/20 rounded-full p-0.5 transition-colors"
        aria-label="Clear filter"
      >
        <X className="h-3 w-3" />
      </button>
    </div>
  );
}
