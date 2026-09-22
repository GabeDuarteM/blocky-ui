"use client";

import { Combobox as ComboboxPrimitive } from "@base-ui/react/combobox";
import { Search, X } from "lucide-react";
import { useCallback, useRef, useState } from "react";
import { Button } from "~/components/ui/button";
import {
  Combobox,
  ComboboxContent,
  ComboboxGroup,
  ComboboxItem,
  ComboboxLabel,
  ComboboxList,
} from "~/components/ui/combobox";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "~/components/ui/input-group";
import {
  type FilterValue,
  formatCount,
  useFilterSuggestions,
} from "~/hooks/use-filter-suggestions";
import { cn } from "~/lib/utils";

export type QueryLogFilter =
  | FilterValue
  | { type: "domain-search"; value: string };

const filterLabels = {
  "domain-search": "Contains",
  domain: "Domain",
  client: "Client",
};

type FilterOption = NonNullable<QueryLogFilter> & { count: number | null };

interface QueryLogFilterComboboxProps {
  value: QueryLogFilter;
  onChange: (value: QueryLogFilter) => void;
}

export function QueryLogFilterCombobox({
  value,
  onChange,
}: QueryLogFilterComboboxProps) {
  const [search, setSearch] = useState("");
  const anchorRef = useRef<HTMLDivElement>(null);
  const query = search.trim();
  const suggestions = useFilterSuggestions(query);
  const groups = [
    {
      label: "Domains",
      items: suggestions.domains.map(
        ({ domain, count }): FilterOption => ({
          type: "domain",
          value: domain,
          count,
        }),
      ),
    },
    {
      label: "Clients",
      items: suggestions.clients.map(
        ({ client, count }): FilterOption => ({
          type: "client",
          value: client,
          count,
        }),
      ),
    },
  ];
  const suggestionGroups = suggestions.isLoading
    ? []
    : groups.filter((group) => group.items.length > 0);
  const searchOptions: FilterOption[] = query
    ? [{ type: "domain-search", value: query, count: null }]
    : [];
  const visibleGroups = [
    ...(searchOptions.length
      ? [{ label: "Search", items: searchOptions }]
      : []),
    ...suggestionGroups,
  ];

  const handleSearchChange = useCallback(
    (
      inputValue: string,
      details: ComboboxPrimitive.Root.ChangeEventDetails,
    ) => {
      setSearch(details.reason === "input-change" ? inputValue : "");
    },
    [],
  );
  const getFilterLabel = useCallback(
    (item: NonNullable<QueryLogFilter>) => item.value,
    [],
  );
  const isSameFilter = useCallback(
    (
      item: NonNullable<QueryLogFilter>,
      selected: NonNullable<QueryLogFilter>,
    ) => item.type === selected.type && item.value === selected.value,
    [],
  );
  return (
    <Combobox<NonNullable<QueryLogFilter>>
      items={visibleGroups}
      value={value}
      onValueChange={onChange}
      onInputValueChange={handleSearchChange}
      itemToStringLabel={getFilterLabel}
      isItemEqualToValue={isSameFilter}
      filter={null}
      autoHighlight={query.length > 0}
    >
      <InputGroup
        ref={anchorRef}
        controlSize="responsive"
        className="items-baseline sm:flex-1"
      >
        <Search className="pointer-events-none absolute top-1/2 left-2.5 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        {value ? (
          <InputGroupAddon className="items-baseline py-1 pl-8 font-normal text-base md:text-sm">
            <span className="text-primary">{filterLabels[value.type]}:</span>
          </InputGroupAddon>
        ) : null}
        <ComboboxPrimitive.Input
          aria-label="Filter query logs"
          placeholder="Filter by domain or client..."
          render={
            <InputGroupInput
              className={cn(
                "h-full pr-8",
                value ? "!pl-1 text-primary" : "pl-8",
              )}
            />
          }
        />
        <ComboboxPrimitive.Clear
          aria-label="Clear filter"
          render={
            <Button
              variant="ghost"
              size="icon"
              className="absolute top-1/2 right-2.5 h-auto w-auto -translate-y-1/2 p-0.5 text-muted-foreground hover:text-foreground"
            />
          }
        >
          <X className="h-4 w-4" />
        </ComboboxPrimitive.Clear>
      </InputGroup>
      <ComboboxContent anchor={anchorRef} sideOffset={4} className="border p-0">
        <ComboboxList
          className="max-h-[300px] p-0"
          aria-busy={suggestions.isLoading}
        >
          {visibleGroups.map((group) => (
            <ComboboxGroup key={group.label} className="p-1">
              <ComboboxLabel className="font-medium">
                {group.label}
              </ComboboxLabel>
              {group.items.map((item) => (
                <ComboboxItem
                  key={`${item.type}:${item.value}`}
                  value={item}
                  className="pr-2 pl-10 [&_[data-slot=combobox-item-indicator]]:right-auto [&_[data-slot=combobox-item-indicator]]:left-2"
                >
                  <span className="flex-1 truncate">
                    {item.count === null
                      ? `Domains containing "${item.value}"`
                      : item.value}
                  </span>
                  {item.count === null ? null : (
                    <span className="ml-2 text-muted-foreground text-xs">
                      {formatCount(item.count)}
                    </span>
                  )}
                </ComboboxItem>
              ))}
            </ComboboxGroup>
          ))}
        </ComboboxList>
        {suggestions.isLoading || visibleGroups.length === 0 ? (
          <div role="status" className="py-6 text-center text-sm">
            {suggestions.isLoading ? "Searching..." : "No suggestions found."}
          </div>
        ) : null}
        <p className="border-t px-3 py-2 text-muted-foreground text-xs">
          Suggestions and counts cover the last 24 hours.
        </p>
      </ComboboxContent>
    </Combobox>
  );
}
