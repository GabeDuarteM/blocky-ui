"use client";

import { Check } from "lucide-react";
import { cn } from "~/lib/utils";
import {
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandList,
} from "~/components/ui/command";
import {
  type FilterSuggestions,
  formatCount,
  type FilterValue,
} from "~/hooks/use-filter-suggestions";

interface FilterSelectProps {
  value: FilterValue;
  suggestions: FilterSuggestions;
  onSelect: (type: "domain" | "client", value: string) => void;
}

export function FilterSelect({
  value,
  suggestions,
  onSelect,
}: FilterSelectProps) {
  const { domains, clients } = suggestions;

  return (
    <CommandList>
      <CommandEmpty>No results found.</CommandEmpty>
      {domains.length > 0 && (
        <CommandGroup heading="Domains">
          {domains.map((domain) => (
            <CommandItem
              key={`domain:${domain.domain}`}
              value={`domain:${domain.domain}`}
              onSelect={() => onSelect("domain", domain.domain)}
            >
              <Check
                className={cn(
                  "mr-2 h-4 w-4",
                  value?.type === "domain" && value.value === domain.domain
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
              onSelect={() => onSelect("client", client.client)}
            >
              <Check
                className={cn(
                  "mr-2 h-4 w-4",
                  value?.type === "client" && value.value === client.client
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
  );
}
