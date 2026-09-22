"use client";

import { ChevronRight, Clock3, Server } from "lucide-react";
import { useCallback, useState } from "react";
import {
  formatQueryDuration,
  getQueryReason,
} from "~/components/dashboard/query-logs/query-log-format";
import { QueryReasonBadge } from "~/components/dashboard/query-logs/query-reason-badge";
import type { LogEntry } from "~/server/logs/types";

export function MobileQueryLog({
  entry,
  showServer,
}: {
  entry: LogEntry;
  showServer: boolean;
}) {
  const [hasTruncatedName, setHasTruncatedName] = useState(false);
  const observeSummary = useCallback((element: HTMLElement | null) => {
    if (!element) {
      return;
    }
    const observer = new ResizeObserver(() => {
      setHasTruncatedName(
        [...element.querySelectorAll("[data-query-name]")].some(
          (name) => name.scrollWidth > name.clientWidth,
        ),
      );
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  const { detail } = getQueryReason(entry);
  const timestamp = entry.requestTs ? new Date(entry.requestTs) : null;
  const client = entry.clientName || entry.clientIp || "Unknown client";

  return (
    <details className="group open:bg-muted/25">
      <summary
        ref={observeSummary}
        className="grid cursor-pointer list-none grid-cols-[6rem_minmax(0,1fr)_0.875rem] grid-rows-[auto_auto] items-center gap-x-3 gap-y-1 px-3 py-3.5 outline-offset-[-2px] hover:bg-muted/40 focus-visible:bg-muted/40 focus-visible:outline-2 focus-visible:outline-ring motion-safe:transition-colors [&::-webkit-details-marker]:hidden"
      >
        <span className="row-span-2 grid h-full grid-rows-subgrid items-center justify-items-center border-border/60 border-r pr-3">
          <QueryReasonBadge entry={entry} />
          <time
            dateTime={entry.requestTs ?? undefined}
            className="text-muted-foreground text-xs tabular-nums"
          >
            {timestamp?.toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
              hour12: false,
            }) ?? "Unknown"}
          </time>
        </span>
        <span data-query-name className="min-w-0 truncate text-sm">
          {entry.questionName || "Unknown domain"}
        </span>
        <ChevronRight
          aria-hidden
          className="row-span-2 size-3.5 text-muted-foreground group-open:rotate-90 motion-safe:transition-transform"
        />
        <span
          data-query-name
          className="col-start-2 min-w-0 truncate text-muted-foreground text-xs"
        >
          {client}
        </span>
      </summary>
      <div className="space-y-4 border-border/60 border-t px-6 py-4">
        {hasTruncatedName ? (
          <dl className="space-y-3">
            <div>
              <dt className="text-muted-foreground text-xs">Domain</dt>
              <dd className="mt-1 break-all text-sm">
                {entry.questionName || "Unknown domain"}
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground text-xs">Client</dt>
              <dd className="mt-1 break-words text-sm">{client}</dd>
            </div>
          </dl>
        ) : null}
        <dl className="grid grid-cols-2 gap-4">
          <div>
            <dt className="text-muted-foreground text-xs">Record type</dt>
            <dd className="mt-1 break-words text-sm">
              {entry.questionType || "Unknown"}
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground text-xs">Duration</dt>
            <dd className="mt-1 text-sm">{formatQueryDuration(entry)}</dd>
          </div>
        </dl>
        {detail ? (
          <div>
            <p className="text-muted-foreground text-xs">Reason</p>
            <p className="mt-1 break-words text-sm leading-relaxed">{detail}</p>
          </div>
        ) : null}
        <div className="space-y-2 text-muted-foreground text-xs">
          {entry.clientIp && entry.clientIp !== client ? (
            <p className="break-all">
              Client IP{" "}
              <span className="ml-1 text-foreground">{entry.clientIp}</span>
            </p>
          ) : null}
          {showServer ? (
            <div className="flex items-start gap-2">
              <Server aria-hidden className="mt-0.5 size-3.5 shrink-0" />
              <span className="min-w-0 break-words">
                Server{" "}
                <span className="ml-1 text-foreground">
                  {entry.hostname || "Unknown"}
                </span>
              </span>
            </div>
          ) : null}
          <div className="flex items-start gap-2">
            <Clock3 aria-hidden className="mt-0.5 size-3.5 shrink-0" />
            <time dateTime={entry.requestTs ?? undefined}>
              {timestamp?.toLocaleString() ?? "Unknown time"}
            </time>
          </div>
        </div>
      </div>
    </details>
  );
}
