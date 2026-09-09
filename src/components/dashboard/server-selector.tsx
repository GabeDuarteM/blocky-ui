"use client";

import { useCountdown } from "~/hooks/use-countdown";
import { useState } from "react";
import { ChevronDown, Search, Server as ServerIcon } from "lucide-react";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Switch } from "~/components/ui/switch";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "~/components/ui/popover";
import { cn } from "~/lib/utils";
export type PickerServer = {
  id: string;
  name: string;
  online: boolean | undefined;
  blocking?: boolean;
  disabledGroups?: string[];
  autoEnableInSec?: number;
  statusUpdatedAt?: number;
};

type SelectionProps = {
  label: string;
  selected: string[];
  servers: PickerServer[];
  onToggle: (id: string) => void;
};

function Health({ server }: { server: PickerServer }) {
  return (
    <span
      className={cn(
        "flex items-center gap-1.5 text-xs",
        server.online === false ? "text-amber-400" : "text-muted-foreground",
      )}
    >
      <span
        className={cn(
          "size-1.5 shrink-0 rounded-full",
          server.online === undefined
            ? "bg-muted-foreground"
            : server.online
              ? "bg-emerald-400"
              : "bg-amber-400",
        )}
      />
      {server.online === undefined
        ? "Connecting"
        : server.online
          ? "Online"
          : "Unreachable"}
    </span>
  );
}

function BlockingLabel({ server }: { server: PickerServer }) {
  const remaining = useCountdown(
    server.autoEnableInSec,
    server.statusUpdatedAt ?? 0,
  );
  return (
    <span
      className={cn(
        "max-w-32 rounded border px-1.5 py-0.5 text-[11px] break-words",
        server.blocking
          ? "border-emerald-400/30 text-emerald-400"
          : "border-red-400/30 text-red-400",
      )}
      title={
        [
          server.disabledGroups?.length
            ? `Disabled groups: ${server.disabledGroups.join(", ")}`
            : undefined,
          remaining ? `Blocking re-enables in ${remaining} seconds` : undefined,
        ]
          .filter(Boolean)
          .join(". ") || undefined
      }
    >
      {server.blocking
        ? "Blocking on"
        : remaining
          ? `Off · ${Math.ceil(remaining / 60)}m`
          : "Blocking off"}
      {!server.blocking &&
        Boolean(server.disabledGroups?.length) &&
        ` · ${server.disabledGroups?.join(", ")}`}
    </span>
  );
}

function ServerList({ label, selected, servers, onToggle }: SelectionProps) {
  const [search, setSearch] = useState("");
  const matches = servers.filter((server) =>
    `${server.name} ${server.id}`.toLowerCase().includes(search.toLowerCase()),
  );
  return (
    <div className="min-w-0">
      <div className="relative border-b p-2">
        <Search className="text-muted-foreground pointer-events-none absolute top-5 left-4 size-4" />
        <Input
          aria-label={`Search ${label}`}
          placeholder="Find a server"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          className="h-9 rounded-none border-0 bg-transparent pl-8 shadow-none focus-visible:ring-0 dark:bg-transparent"
        />
      </div>
      <div
        role="group"
        aria-label={label}
        className="max-h-56 overflow-y-auto overscroll-contain p-1 [color-scheme:dark]"
      >
        {matches.map((server) => {
          const isSelected = selected.includes(server.id);
          const isLastSelected = selected.length === 1 && isSelected;

          return (
            <label
              key={server.id}
              className="hover:bg-accent flex cursor-pointer items-center gap-3 rounded-md px-3 py-3"
            >
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm">{server.name}</span>
                <Health server={server} />
              </span>
              {label === "Blocking targets" && server.online && (
                <BlockingLabel server={server} />
              )}
              <Switch
                aria-label={`${label}: ${server.name}`}
                checked={isSelected}
                disabled={isLastSelected}
                onCheckedChange={() => onToggle(server.id)}
              />
            </label>
          );
        })}
        {!matches.length && (
          <p className="text-muted-foreground px-3 py-5 text-sm">
            No matching servers
          </p>
        )}
      </div>
    </div>
  );
}

export function ActionTargets({
  actionLabel,
  matchTriggerWidth = true,
  ...props
}: SelectionProps & { actionLabel: string; matchTriggerWidth?: boolean }) {
  const selectedNames = props.servers
    .filter((server) => props.selected.includes(server.id))
    .map((server) => server.name);
  const summary =
    selectedNames.length === props.servers.length
      ? `All ${props.servers.length} servers`
      : `${selectedNames.length} ${selectedNames.length === 1 ? "server" : "servers"}`;
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          aria-label={`Choose ${props.label}`}
          className="bg-card dark:bg-card dark:hover:bg-accent h-auto w-full justify-start gap-3 rounded-lg p-3"
        >
          <ServerIcon className="text-muted-foreground size-5 shrink-0" />
          <span className="min-w-0 flex-1 text-left">
            <span className="block text-sm font-medium">
              <span className="text-muted-foreground font-normal">
                {actionLabel}:{" "}
              </span>
              {summary}
            </span>
            <span className="text-muted-foreground block truncate text-xs font-normal">
              {selectedNames.join(", ")}
            </span>
          </span>
          {props.servers.some(
            (server) =>
              props.selected.includes(server.id) && server.online === false,
          ) && (
            <span className="text-xs text-amber-400">
              {
                props.servers.filter(
                  (server) =>
                    props.selected.includes(server.id) &&
                    server.online === false,
                ).length
              }{" "}
              unreachable
            </span>
          )}
          <ChevronDown className="text-muted-foreground size-4" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className={cn(
          "bg-popover dark:bg-popover max-w-[calc(100vw-2rem)] overflow-hidden p-0",
          matchTriggerWidth ? "w-[var(--radix-popover-trigger-width)]" : "w-80",
        )}
      >
        <ServerList {...props} />
      </PopoverContent>
    </Popover>
  );
}
