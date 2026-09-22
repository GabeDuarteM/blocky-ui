"use client";

import { Filter, X } from "lucide-react";
import { useCallback, useState } from "react";
import { Button } from "~/components/ui/button";
import { Command, CommandInput } from "~/components/ui/command";
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
import {
  type FilterValue,
  useFilterSuggestions,
} from "~/hooks/use-filter-suggestions";
import type { TimeRange } from "~/lib/constants";
import { FilterSelect } from "../filter-select";

export type ChartFilter = FilterValue;

interface ChartFilterComboboxProps {
  value: ChartFilter;
  onChange: (value: ChartFilter) => void;
  range: TimeRange;
}

export function ChartFilterCombobox({
  value,
  onChange,
  range,
}: ChartFilterComboboxProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  const suggestions = useFilterSuggestions(search, range);

  const handleSelect = useCallback(
    (type: "domain" | "client", selectedValue: string) => {
      onChange({ type, value: selectedValue });
      setOpen(false);
      setSearch("");
    },
    [onChange],
  );

  const handleClear = useCallback(() => {
    onChange(null);
  }, [onChange]);

  const hasFilter = value !== null;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <Tooltip>
        <TooltipTrigger asChild>
          <PopoverTrigger asChild>
            <Button
              variant={hasFilter ? "default" : "outline"}
              size="responsive-icon"
              aria-label="Filter chart"
            >
              <Filter className="h-4 w-4" />
            </Button>
          </PopoverTrigger>
        </TooltipTrigger>
        <TooltipContent side="bottom">
          <p>Filter by domain or client</p>
        </TooltipContent>
      </Tooltip>
      <PopoverContent className="w-[300px] p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput
            placeholder="Search domains or clients..."
            value={search}
            onValueChange={setSearch}
          />
          <FilterSelect
            value={value}
            suggestions={suggestions}
            onSelect={handleSelect}
          />
          {hasFilter ? (
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
          ) : null}
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
  if (!filter) {
    return null;
  }

  const typeLabel = filter.type === "domain" ? "Domain" : "Client";

  return (
    <div className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 py-0.5 pr-1 pl-2.5 font-medium text-primary text-xs">
      <span className="max-w-[150px] truncate">
        {typeLabel}: {filter.value}
      </span>
      <Button
        variant="ghost"
        size="icon"
        onClick={onClear}
        className="h-auto w-auto rounded-full p-0.5 hover:bg-primary/20"
        aria-label="Clear filter"
      >
        <X className="h-3 w-3" />
      </Button>
    </div>
  );
}
