"use client";

import { useState, useRef } from "react";
import { Combobox as ComboboxPrimitive } from "@base-ui/react/combobox";
import { Search, X } from "lucide-react";
import { cn } from "~/lib/utils";
import { Button } from "~/components/ui/button";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "~/components/ui/input-group";
import {
  Combobox,
  ComboboxContent,
  ComboboxGroup,
  ComboboxLabel,
  ComboboxItem,
  ComboboxList,
} from "~/components/ui/combobox";
import {
  useFilterSuggestions,
  formatCount,
  type FilterValue,
} from "~/hooks/use-filter-suggestions";

export type QueryLogFilter =
  FilterValue | { type: "domain-search"; value: string };

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
      items: suggestions.domains.map(({ domain, count }): FilterOption => ({
        type: "domain",
        value: domain,
        count,
      })),
    },
    {
      label: "Clients",
      items: suggestions.clients.map(({ client, count }): FilterOption => ({
        type: "client",
        value: client,
        count,
      })),
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

  return (
    <Combobox<NonNullable<QueryLogFilter>>
      items={visibleGroups}
      value={value}
      onValueChange={onChange}
      onInputValueChange={(inputValue, details) => {
        setSearch(details.reason === "input-change" ? inputValue : "");
      }}
      itemToStringLabel={(item) => item.value}
      isItemEqualToValue={(item, selected) =>
        item.type === selected.type && item.value === selected.value
      }
      filter={null}
      autoHighlight={query.length > 0}
    >
      <InputGroup
        ref={anchorRef}
        controlSize="responsive"
        className="items-baseline sm:flex-1"
      >
        <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 h-4 w-4 -translate-y-1/2" />
        {value && (
          <InputGroupAddon className="items-baseline py-1 pl-8 text-base font-normal md:text-sm">
            <span className="text-primary">
              {value.type === "domain-search"
                ? "Contains"
                : value.type === "domain"
                  ? "Domain"
                  : "Client"}
              :
            </span>
          </InputGroupAddon>
        )}
        <ComboboxPrimitive.Input
          aria-label="Filter query logs"
          placeholder="Filter by domain or client..."
          render={
            <InputGroupInput
              className={cn(
                "h-full pr-8",
                value ? "text-primary !pl-1" : "pl-8",
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
              className="text-muted-foreground hover:text-foreground absolute top-1/2 right-2.5 h-auto w-auto -translate-y-1/2 p-0.5"
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
                  {item.count !== null && (
                    <span className="text-muted-foreground ml-2 text-xs">
                      {formatCount(item.count)}
                    </span>
                  )}
                </ComboboxItem>
              ))}
            </ComboboxGroup>
          ))}
        </ComboboxList>
        {(suggestions.isLoading || visibleGroups.length === 0) && (
          <div role="status" className="py-6 text-center text-sm">
            {suggestions.isLoading ? "Searching..." : "No suggestions found."}
          </div>
        )}
        <p className="text-muted-foreground border-t px-3 py-2 text-xs">
          Suggestions and counts cover the last 24 hours.
        </p>
      </ComboboxContent>
    </Combobox>
  );
}
