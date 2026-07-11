"use client";

import { useEffect, useRef, useState } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import type { LogEntry } from "~/server/logs/types";

import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "~/components/ui/tooltip";
import { Badge, type BadgeVariants } from "~/components/ui/badge";

interface DomainCellProps {
  domain: string;
}

function DomainCell({ domain }: DomainCellProps) {
  const textRef = useRef<HTMLDivElement>(null);
  const [isTruncated, setIsTruncated] = useState(false);

  useEffect(() => {
    const element = textRef.current;
    if (!element) {
      return;
    }

    setIsTruncated(element.scrollWidth > element.clientWidth);
  }, [domain]);

  const content = (
    <div className="flex h-full cursor-text items-center">
      <div ref={textRef} className="max-w-50 truncate select-text">
        {domain}
      </div>
    </div>
  );

  if (!isTruncated) {
    return content;
  }

  return (
    <TooltipProvider>
      <Tooltip delayDuration={100}>
        <TooltipTrigger asChild>{content}</TooltipTrigger>
        <TooltipContent>
          <p>{domain}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

export const columns: ColumnDef<LogEntry>[] = [
  {
    accessorKey: "requestTs",
    header: "Time",
    cell: ({ row }) => {
      const timestamp = row.original.requestTs;
      if (!timestamp) return null;
      // Postgres stores all timestamps in UTC
      // Display in browser's local timezone if possible
      const date = new Date(timestamp);
      return date.toLocaleString(undefined, {
        year: "2-digit",
        month: "numeric",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
        second: "2-digit",
      });
    },
  },
  {
    accessorKey: "clientName",
    header: "Client Name",
  },
  {
    accessorKey: "questionName",
    header: "Domain",
    cell: ({ row }) => {
      const domain = row.original.questionName;
      if (!domain) return null;
      return <DomainCell domain={domain} />;
    },
  },
  {
    accessorKey: "questionType",
    header: "Type",
  },
  {
    accessorKey: "reason",
    header: "Reason",
    cell: ({ row }) => {
      const reason = row.original.reason;
      if (!reason) return null;

      const regex = /\((.*?)\)/;
      const match = regex.exec(reason);
      const tooltipText = match ? match[1] : null;
      const displayText = reason.replace(/\(.*?\)/, "").trim();

      const responseType = row.original.responseType;
      let tooltipContent = tooltipText;

      if (responseType === "RESOLVED") {
        tooltipContent = `Resolved by: ${tooltipText}`;
      } else if (responseType === "BLOCKED") {
        tooltipContent = `Group: ${tooltipText}`;
      }

      let badgeVariant: BadgeVariants = "outline";

      if (responseType === "BLOCKED") {
        badgeVariant = "destructive";
      } else if (responseType === "RESOLVED") {
        badgeVariant = "default";
      }

      const badge = <Badge variant={badgeVariant}>{displayText}</Badge>;

      if (!tooltipContent) {
        return badge;
      }

      return (
        <TooltipProvider>
          <Tooltip delayDuration={100}>
            <TooltipTrigger>{badge}</TooltipTrigger>
            <TooltipContent>
              <p>{tooltipContent}</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      );
    },
  },
  {
    accessorKey: "durationMs",
    header: "Duration",
    cell: ({ row }) => {
      const duration = row.original.durationMs;
      const responseType = row.original.responseType;
      const isLocalResponse =
        responseType === "CACHED" ||
        responseType === "HOSTSFILE" ||
        responseType === "CUSTOMDNS" ||
        responseType === "BLOCKED" ||
        responseType === "SPECIAL" ||
        responseType === "FILTERED" ||
        responseType === "NOTFQDN";

      if (duration == null) {
        return null;
      }

      if (duration === 0 && isLocalResponse) {
        return <span className="text-muted-foreground">—</span>;
      }

      return `${duration}ms`;
    },
  },
];
