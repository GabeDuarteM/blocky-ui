"use client";

import { getQueryReason } from "~/components/dashboard/query-logs/query-log-format";
import { Badge } from "~/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "~/components/ui/tooltip";
import type { LogEntry } from "~/server/logs/types";

export function QueryReasonBadge({
  entry,
  showTooltip = false,
}: {
  entry: Pick<LogEntry, "reason" | "responseType">;
  showTooltip?: boolean;
}) {
  const { label, detail } = getQueryReason(entry);
  const resolvedVariant =
    entry.responseType === "RESOLVED" ? "default" : "outline";
  const variant =
    entry.responseType === "BLOCKED" || entry.responseType === "REBIND"
      ? "destructive"
      : resolvedVariant;
  const badge = (
    <Badge
      variant={variant}
      className="max-w-full whitespace-normal py-1 text-center"
    >
      <span className="min-w-0 break-words capitalize">
        {label.toLowerCase()}
      </span>
    </Badge>
  );

  if (!(showTooltip && detail)) {
    return badge;
  }

  return (
    <TooltipProvider>
      <Tooltip delayDuration={100}>
        <TooltipTrigger asChild>
          <button
            type="button"
            className="max-w-full rounded-md outline-offset-4"
            aria-label={`${label}: ${detail}`}
          >
            {badge}
          </button>
        </TooltipTrigger>
        <TooltipContent>{detail}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
