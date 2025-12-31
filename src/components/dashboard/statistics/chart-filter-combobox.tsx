"use client";

import { useState } from "react";
import { Filter, X } from "lucide-react";
import { cn } from "~/lib/utils";
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
import { type TimeRange } from "~/lib/constants";
import {
  useFilterSuggestions,
  type FilterValue,
} from "~/hooks/use-filter-suggestions";
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
          <FilterSelect
            value={value}
            suggestions={suggestions}
            onSelect={handleSelect}
          />
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
      <Button
        variant="ghost"
        size="icon"
        onClick={onClear}
        className="hover:bg-primary/20 h-auto w-auto rounded-full p-0.5"
        aria-label="Clear filter"
      >
        <X className="h-3 w-3" />
      </Button>
    </div>
  );
}
