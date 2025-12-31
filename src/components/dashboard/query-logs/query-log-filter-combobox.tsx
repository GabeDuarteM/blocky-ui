"use client";

import { useState, useRef, type KeyboardEvent } from "react";
import { Search, X } from "lucide-react";
import { cn } from "~/lib/utils";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Command } from "~/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverAnchor,
} from "~/components/ui/popover";
import {
  useFilterSuggestions,
  type FilterValue,
} from "~/hooks/use-filter-suggestions";
import { FilterSelect } from "../filter-select";

export type QueryLogFilter = FilterValue;

interface QueryLogFilterComboboxProps {
  value: QueryLogFilter;
  onChange: (value: QueryLogFilter) => void;
}

export function QueryLogFilterCombobox({
  value,
  onChange,
}: QueryLogFilterComboboxProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const commandRef = useRef<HTMLDivElement>(null);

  const suggestions = useFilterSuggestions(search);

  const handleSelect = (type: "domain" | "client", selectedValue: string) => {
    onChange({ type, value: selectedValue });
    setOpen(false);
    setSearch("");
  };

  const handleClear = () => {
    onChange(null);
    setSearch("");
    setOpen(true);
    inputRef.current?.focus();
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (value && e.key !== "Tab") {
      e.preventDefault();
      if (e.key === "Backspace" || e.key === "Delete") {
        handleClear();
      } else if (e.key.length === 1) {
        onChange(null);
        setSearch(e.key);
        setOpen(true);
      }
      return;
    }

    if (e.key === "ArrowDown" || e.key === "ArrowUp" || e.key === "Enter") {
      // Forward navigation keys to Command since Input is outside its scope
      commandRef.current?.dispatchEvent(
        new KeyboardEvent("keydown", {
          key: e.key,
          bubbles: true,
          cancelable: true,
        }),
      );
    }

    if (e.key === "Escape") {
      setOpen(false);
    }
  };

  const displayValue = value
    ? `${value.type === "domain" ? "Domain" : "Client"}: ${value.value}`
    : "";

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverAnchor asChild>
        <div className="relative flex-1">
          <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 h-4 w-4 -translate-y-1/2" />
          <Input
            ref={inputRef}
            placeholder="Filter by domain or client..."
            value={value ? displayValue : search}
            onChange={(e) => {
              if (!value) {
                setSearch(e.target.value);
              }
            }}
            onKeyDown={handleKeyDown}
            onFocus={() => setOpen(true)}
            className={cn("pr-8 pl-8", value && "text-primary")}
          />
          {value && (
            <Button
              variant="ghost"
              size="icon"
              onClick={handleClear}
              className="text-muted-foreground hover:text-foreground absolute top-1/2 right-2.5 h-auto w-auto -translate-y-1/2 p-0.5"
              aria-label="Clear filter"
            >
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
      </PopoverAnchor>
      <PopoverContent
        className="w-[var(--radix-popover-trigger-width)] p-0"
        align="start"
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <Command ref={commandRef} shouldFilter={false}>
          <FilterSelect
            value={value}
            suggestions={suggestions}
            onSelect={handleSelect}
          />
        </Command>
      </PopoverContent>
    </Popover>
  );
}
