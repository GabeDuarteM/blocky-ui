"use client";

import type { ColumnDef, CoreFeatures } from "@tanstack/react-table";
import type { QueryLogRow } from "~/components/dashboard/query-logs/query-log-identity";

import { QueryReasonBadge } from "~/components/dashboard/query-logs/query-reason-badge";
import { formatQueryDuration } from "~/components/dashboard/query-logs/query-log-format";
import { OverflowTooltip } from "~/components/overflow-tooltip";

interface DomainCellProps {
  domain: string;
}

function DomainCell({ domain }: DomainCellProps) {
  return (
    <div className="flex h-full items-center">
      <OverflowTooltip
        text={domain}
        className="max-w-50 cursor-text select-text"
      />
    </div>
  );
}

export const columns: ColumnDef<CoreFeatures, QueryLogRow>[] = [
  {
    accessorKey: "requestTs",
    header: "Time",
    cell: ({ row }) => {
      const timestamp = row.original.requestTs;
      if (!timestamp) {
        return null;
      }
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
      if (!domain) {
        return null;
      }
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
    cell: ({ row }) => <QueryReasonBadge entry={row.original} showTooltip />,
  },
  {
    accessorKey: "durationMs",
    header: "Duration",
    cell: ({ row }) => formatQueryDuration(row.original),
  },
];
