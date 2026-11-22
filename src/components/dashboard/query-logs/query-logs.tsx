"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { History, RefreshCw } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { MobileQueryLog } from "~/components/dashboard/query-logs/mobile-query-log";
import type { QueryLogRow } from "~/components/dashboard/query-logs/query-log-identity";
import { identifyQueryLogRows } from "~/components/dashboard/query-logs/query-log-identity";
import {
  useDashboardServers,
  useSelectedServers,
} from "~/components/dashboard/server-context";
import { Button } from "~/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import { Label } from "~/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { Switch } from "~/components/ui/switch";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "~/components/ui/tooltip";
import { useLogDiagnostics } from "~/hooks/use-log-diagnostics";
import { usePrefetchAdjacentPages } from "~/hooks/use-prefetch-adjacent-pages";
import {
  BLOCKY_DNS_RECORD_TYPES,
  BLOCKY_RESPONSE_TYPES,
  isDnsRecordType,
  isResponseType,
} from "~/lib/constants";
import { keepDataForServers } from "~/lib/keep-server-data";
import { useTRPC } from "~/trpc/react";
import { columns } from "./columns";
import { DataTable } from "./data-table";
import type { QueryLogFilter } from "./query-log-filter-combobox";
import { QueryLogFilterCombobox } from "./query-log-filter-combobox";

const serverColumns: typeof columns = [
  { accessorKey: "hostname", header: "Server" },
  ...columns,
];

function logPagination({
  rowsWithPeek,
  totalCount,
  rowsAreFromPreviousKey,
  pageIndex,
  pageSize,
}: {
  rowsWithPeek: number;
  totalCount: number | undefined;
  rowsAreFromPreviousKey: boolean;
  pageIndex: number;
  pageSize: number;
}) {
  const pageCount =
    totalCount === undefined ? undefined : Math.ceil(totalCount / pageSize);
  const hasNextPage = rowsAreFromPreviousKey
    ? pageCount !== undefined && pageIndex < pageCount - 1
    : rowsWithPeek > pageSize;

  return { pageCount, hasNextPage };
}

export function QueryLogs({
  showServerColumn = false,
}: {
  showServerColumn?: boolean;
}) {
  const trpc = useTRPC();
  const dashboard = useDashboardServers();
  const serverIds = useSelectedServers("view");
  const scopeKey = serverIds.join(",");
  const [pageState, setPageState] = useState({ scopeKey, page: 0 });
  const pageIndex = pageState.scopeKey === scopeKey ? pageState.page : 0;
  const setPageIndex = useCallback(
    (page: number) => setPageState({ scopeKey, page }),
    [scopeKey],
  );
  const [filter, setFilter] = useState<QueryLogFilter>(null);
  const [responseTypeFilter, setResponseTypeFilter] = useState("ALL");
  const [questionTypeFilter, setQuestionTypeFilter] = useState("ALL");
  const [pageSize, setPageSize] = useState(10);
  const [autoRefresh, setAutoRefresh] = useState(true);

  const handleFilterChange = useCallback(
    (value: QueryLogFilter) => {
      setFilter(value);
      setPageIndex(0);
    },
    [setPageIndex],
  );

  const handleResponseTypeChange = useCallback(
    (value: string) => {
      setResponseTypeFilter(value);
      setPageIndex(0);
    },
    [setPageIndex],
  );

  const handleQuestionTypeChange = useCallback(
    (value: string) => {
      setQuestionTypeFilter(value);
      setPageIndex(0);
    },
    [setPageIndex],
  );

  const search = filter?.type === "domain-search" ? filter.value : undefined;
  const domain = filter?.type === "domain" ? filter.value : undefined;
  const client = filter?.type === "client" ? filter.value : undefined;
  const responseType = isResponseType(responseTypeFilter)
    ? responseTypeFilter
    : undefined;
  const questionType = isDnsRecordType(questionTypeFilter)
    ? questionTypeFilter
    : undefined;
  const searchParams = {
    search,
    domain,
    client,
    limit: pageSize,
    offset: pageIndex * pageSize,
    responseType,
    questionType,
  };

  const rows = useQuery(
    trpc.logs.rows.queryOptions(
      { ...searchParams, limit: pageSize + 1, serverIds },
      {
        placeholderData: keepDataForServers(serverIds),
        refetchOnWindowFocus: autoRefresh,
        refetchInterval: autoRefresh ? 30_000 : false,
      },
    ),
  );
  const count = useQuery(
    trpc.logs.count.queryOptions(
      { search, domain, client, responseType, questionType, serverIds },
      {
        placeholderData: keepDataForServers(serverIds),
        refetchOnWindowFocus: autoRefresh,
        refetchInterval: autoRefresh ? 30_000 : false,
      },
    ),
  );
  useLogDiagnostics("rows", rows.data?.diagnostics);
  useLogDiagnostics("count", count.data?.diagnostics);
  const queryLogsData = rows.data && {
    items: identifyQueryLogRows(rows.data.items.slice(0, pageSize)).map(
      (item) => ({
        ...item,
        hostname:
          dashboard.servers.find((server) => server.id === item.serverId)
            ?.name ?? "Unknown",
      }),
    ),
    totalCount:
      rows.data.diagnostics.length || count.data?.diagnostics.length
        ? undefined
        : count.data?.totalCount,
  };
  const {
    isFetching: isFetchingLogs,
    isLoading: isLoadingLogs,
    isPlaceholderData: isPlaceholderLogs,
    error,
  } = rows;
  const refetch = useCallback(
    () => Promise.all([rows.refetch(), count.refetch()]),
    [count, rows],
  );

  const handleAutoRefreshChange = useCallback(
    (enabled: boolean) => {
      setAutoRefresh(enabled);
      if (enabled) {
        refetch();
      }
    },
    [refetch],
  );

  useEffect(() => {
    if (error) {
      toast.error("Failed to fetch query logs", {
        description: error.message,
        id: "query-logs-error",
      });
    } else {
      toast.dismiss("query-logs-error");
    }
  }, [error]);

  const { pageCount, hasNextPage } = logPagination({
    rowsWithPeek: rows.data?.items.length ?? 0,
    totalCount: queryLogsData?.totalCount,
    rowsAreFromPreviousKey: isPlaceholderLogs,
    pageIndex,
    pageSize,
  });
  // biome-ignore lint/suspicious/noUnnecessaryConditions: Biome resolves useQuery to its initialData overload. https://github.com/biomejs/biome/issues/12345
  const showLogsLoading = isLoadingLogs || isPlaceholderLogs;
  const queryClient = useQueryClient();

  usePrefetchAdjacentPages({
    enabled: !isFetchingLogs && queryLogsData !== undefined,
    currentPage: pageIndex,
    totalPages: pageCount ?? 0,
    prefetchPage: (targetPage) => {
      queryClient.prefetchQuery(
        trpc.logs.rows.queryOptions({
          ...searchParams,
          serverIds,
          limit: pageSize + 1,
          offset: targetPage * pageSize,
        }),
      );
    },
  });

  const getRowId = useCallback((entry: QueryLogRow) => entry.rowId, []);
  const renderMobileRow = useCallback(
    (entry: QueryLogRow) => (
      <MobileQueryLog entry={entry} showServer={showServerColumn} />
    ),
    [showServerColumn],
  );
  const refreshLogs = useCallback(() => refetch(), [refetch]);
  const table = (
    <DataTable
      columns={showServerColumn ? serverColumns : columns}
      // biome-ignore lint/suspicious/noUnnecessaryConditions: Biome resolves useQuery to its initialData overload. https://github.com/biomejs/biome/issues/12345
      data={queryLogsData?.items ?? []}
      pageCount={pageCount}
      hasNextPage={hasNextPage}
      pageIndex={pageIndex}
      onPageChange={setPageIndex}
      pageSize={pageSize}
      onPageSizeChange={setPageSize}
      isLoading={showLogsLoading}
      getRowId={getRowId}
      renderMobileRow={renderMobileRow}
    />
  );

  return (
    <Card role="region" aria-label="Query Logs">
      <CardHeader>
        <div className="flex w-full flex-row flex-wrap items-center justify-between gap-y-3">
          <div className="flex min-w-40 flex-1 flex-col gap-1">
            <CardTitle className="flex items-center gap-2">
              <History className="h-5 w-5" />
              Query Logs
            </CardTitle>
            <CardDescription>
              View the DNS query logs processed by the server
            </CardDescription>
          </div>
          <div className="flex h-full items-center justify-center gap-4 pl-4">
            <div className="flex items-center gap-2">
              <Label
                htmlFor="auto-refresh"
                className="text-sm text-muted-foreground"
              >
                Auto
              </Label>
              <Tooltip disableHoverableContent>
                <TooltipTrigger asChild>
                  <span className="inline-flex">
                    <Switch
                      id="auto-refresh"
                      checked={autoRefresh}
                      onCheckedChange={handleAutoRefreshChange}
                    />
                  </span>
                </TooltipTrigger>
                <TooltipContent sideOffset={4}>
                  Auto-refresh (every 30s)
                </TooltipContent>
              </Tooltip>
            </div>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="responsive-icon"
                  onClick={refreshLogs}
                  disabled={isFetchingLogs}
                  aria-label="Refresh"
                >
                  <RefreshCw className={isFetchingLogs ? "animate-spin" : ""} />
                </Button>
              </TooltipTrigger>
              <TooltipContent sideOffset={4}>Refresh</TooltipContent>
            </Tooltip>
          </div>
        </div>
        <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center">
          <QueryLogFilterCombobox
            value={filter}
            onChange={handleFilterChange}
          />
          <div className="grid grid-cols-2 gap-2 sm:flex sm:items-center">
            <Select
              value={responseTypeFilter}
              onValueChange={handleResponseTypeChange}
            >
              <SelectTrigger
                size="responsive"
                aria-label="Filter by reason"
                className="w-full sm:w-36"
              >
                <SelectValue placeholder="Response" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All Reasons</SelectItem>
                {BLOCKY_RESPONSE_TYPES.map((type) => (
                  <SelectItem key={type} value={type}>
                    {type}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={questionTypeFilter}
              onValueChange={handleQuestionTypeChange}
            >
              <SelectTrigger
                size="responsive"
                aria-label="Filter by record type"
                className="w-full sm:w-28"
              >
                <SelectValue placeholder="Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All Types</SelectItem>
                {BLOCKY_DNS_RECORD_TYPES.map((type) => (
                  <SelectItem key={type} value={type}>
                    {type}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </CardHeader>
      <CardContent>{table}</CardContent>
    </Card>
  );
}
