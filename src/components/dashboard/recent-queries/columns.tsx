"use client";

import type { ColumnDef } from "@tanstack/react-table";
import type { logEntries } from "~/server/db/schema";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "~/components/ui/tooltip";
import { Badge, type BadgeVariants } from "~/components/ui/badge";

type LogEntry = typeof logEntries.$inferSelect;

export const columns: ColumnDef<LogEntry>[] = [
  {
    accessorKey: "requestTs",
    header: "Time",
    cell: ({ row }) => {
      const timestamp = row.original.requestTs;
      if (!timestamp) return null;
      return timestamp.split(".")[0];
    },
  },
  {
    accessorKey: "clientIp",
    header: "Client IP",
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
      return (
        <TooltipProvider>
          <Tooltip delayDuration={100}>
            <TooltipTrigger>
              <div className="flex h-full items-center">
                <div className="max-w-[200px] truncate">{domain}</div>
              </div>
            </TooltipTrigger>
            <TooltipContent>
              <p>{domain}</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      );
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
      if (!duration) return null;
      return `${duration}ms`;
    },
  },
];
