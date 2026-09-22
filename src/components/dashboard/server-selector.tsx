"use client";

import { ChevronDown, Search, Server as ServerIcon } from "lucide-react";
import type { ChangeEvent } from "react";
import { useCallback, useId, useState } from "react";
import { StatusBadge } from "~/components/dashboard/status-badge";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "~/components/ui/popover";
import { Switch } from "~/components/ui/switch";
import { useCountdown } from "~/hooks/use-countdown";
import { cn } from "~/lib/utils";
export interface PickerServer {
  id: string;
  name: string;
  online: boolean | undefined;
  blocking?: boolean;
  disabledGroups?: string[];
  autoEnableInSec?: number;
  statusUpdatedAt?: number;
}

interface SelectionProps {
  label: string;
  selected: string[];
  servers: PickerServer[];
  onToggle: (id: string) => void;
}

function healthColor(online: boolean | undefined) {
  if (online === undefined) {
    return "bg-muted-foreground";
  }
  return online ? "bg-emerald-400" : "bg-amber-400";
}
function healthLabel(online: boolean | undefined) {
  if (online === undefined) {
    return "Connecting";
  }
  return online ? "Online" : "Unreachable";
}
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
          healthColor(server.online),
        )}
      />
      {healthLabel(server.online)}
    </span>
  );
}

function BlockingLabel({ server }: { server: PickerServer }) {
  const remaining = useCountdown(
    server.autoEnableInSec,
    server.statusUpdatedAt ?? 0,
  );
  const disabledLabel = remaining
    ? `Off · ${Math.ceil(remaining / 60)}m`
    : "Blocking off";
  const blockingLabel = server.blocking ? "Blocking on" : disabledLabel;
  return (
    <StatusBadge
      tone={server.blocking ? "success" : "danger"}
      className="max-w-32 whitespace-normal break-words"
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
      {blockingLabel}
      {!server.blocking && server.disabledGroups?.length
        ? ` · ${server.disabledGroups?.join(", ")}`
        : null}
    </StatusBadge>
  );
}

function ServerOption({
  server,
  label,
  selected,
  onToggle,
}: Omit<SelectionProps, "servers"> & { server: PickerServer }) {
  const id = useId();
  const isSelected = selected.includes(server.id);
  const toggle = useCallback(() => onToggle(server.id), [onToggle, server.id]);
  return (
    <label
      htmlFor={id}
      className="flex cursor-pointer items-center gap-3 rounded-md px-3 py-3 hover:bg-accent"
    >
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm">{server.name}</span>
        <Health server={server} />
      </span>
      {label === "Blocking targets" && server.online ? (
        <BlockingLabel server={server} />
      ) : null}
      <Switch
        id={id}
        aria-label={`${label}: ${server.name}`}
        checked={isSelected}
        disabled={selected.length === 1 && isSelected}
        onCheckedChange={toggle}
      />
    </label>
  );
}
function ServerList({ label, selected, servers, onToggle }: SelectionProps) {
  const [search, setSearch] = useState("");
  const matches = servers.filter((server) =>
    `${server.name} ${server.id}`.toLowerCase().includes(search.toLowerCase()),
  );
  const handleSearchChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => setSearch(event.target.value),
    [],
  );
  return (
    <div className="min-w-0">
      <div className="relative border-b p-2">
        <Search className="pointer-events-none absolute top-5 left-4 size-4 text-muted-foreground" />
        <Input
          aria-label={`Search ${label}`}
          placeholder="Find a server"
          value={search}
          onChange={handleSearchChange}
          className="h-9 rounded-none border-0 bg-transparent pl-8 shadow-none focus-visible:ring-0 dark:bg-transparent"
        />
      </div>
      <fieldset aria-label={label} className="contents">
        <div className="max-h-56 overflow-y-auto overscroll-contain p-1 [color-scheme:dark]">
          {matches.map((server) => (
            <ServerOption
              key={server.id}
              server={server}
              label={label}
              selected={selected}
              onToggle={onToggle}
            />
          ))}
          {matches.length ? null : (
            <p className="px-3 py-5 text-muted-foreground text-sm">
              No matching servers
            </p>
          )}
        </div>
      </fieldset>
    </div>
  );
}

export function ServerSelector({
  description,
  ...props
}: SelectionProps & { description: string }) {
  const connecting = props.servers.some(
    (server) => server.online === undefined,
  );
  const selection =
    props.selected.length === props.servers.length
      ? "All servers"
      : `${props.selected.length} ${props.selected.length === 1 ? "server" : "servers"}`;
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="responsive"
          backdropBlur
          aria-label={`${props.label}: ${selection}`}
          className="max-w-full flex-wrap gap-2 max-[360px]:h-auto max-[360px]:min-h-11 max-[360px]:py-2"
        >
          <ServerIcon className="size-4 text-muted-foreground" />
          <span className="text-muted-foreground">{props.label}:</span>
          {selection}
          <span className="h-4 border-l" />
          <span
            className={cn(
              "flex items-center gap-1.5 text-xs",
              props.servers.some((server) => server.online === false) &&
                "text-amber-400",
            )}
          >
            <span
              className={cn(
                "size-1.5 rounded-full",
                healthColor(
                  connecting
                    ? undefined
                    : props.servers.every((server) => server.online),
                ),
              )}
            />
            {connecting
              ? "Connecting"
              : `${props.servers.filter((server) => server.online).length}/${props.servers.length} online`}
          </span>
          <ChevronDown className="size-4 text-muted-foreground" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="w-[var(--radix-popover-trigger-width)] max-w-[calc(100vw-2rem)] overflow-hidden bg-popover p-0 dark:bg-popover"
      >
        <p className="border-b px-3 py-3 text-muted-foreground text-xs">
          {description}
        </p>
        <ServerList {...props} />
      </PopoverContent>
    </Popover>
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
          className="h-auto w-full justify-start gap-3 p-3"
        >
          <ServerIcon className="size-5 shrink-0 text-muted-foreground" />
          <span className="min-w-0 flex-1 text-left">
            <span className="block font-medium text-sm">
              <span className="font-normal text-muted-foreground">
                {actionLabel}:{" "}
              </span>
              {summary}
            </span>
            <span className="block truncate font-normal text-muted-foreground text-xs">
              {selectedNames.join(", ")}
            </span>
          </span>
          {props.servers.some(
            (server) =>
              props.selected.includes(server.id) && server.online === false,
          ) ? (
            <span className="text-amber-400 text-xs">
              {
                props.servers.filter(
                  (server) =>
                    props.selected.includes(server.id) &&
                    server.online === false,
                ).length
              }{" "}
              unreachable
            </span>
          ) : null}
          <ChevronDown className="size-4 text-muted-foreground" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className={cn(
          "max-w-[calc(100vw-2rem)] overflow-hidden bg-popover p-0 dark:bg-popover",
          matchTriggerWidth ? "w-[var(--radix-popover-trigger-width)]" : "w-80",
        )}
      >
        <ServerList {...props} />
      </PopoverContent>
    </Popover>
  );
}
