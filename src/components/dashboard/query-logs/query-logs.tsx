"use client";

import { useLogDiagnostics } from "~/hooks/use-log-diagnostics";
import { useDashboardServers } from "~/components/dashboard/server-context";
import { api } from "~/trpc/react";
import { History, RefreshCw } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from "~/components/ui/tooltip";
import { Switch } from "~/components/ui/switch";
import { Label } from "~/components/ui/label";
import { useEffect, useState } from "react";
import { DataTable } from "./data-table";
import { columns } from "./columns";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import {
  BLOCKY_RESPONSE_TYPES,
  BLOCKY_DNS_RECORD_TYPES,
  isDnsRecordType,
  isResponseType,
} from "~/lib/constants";
import {
  QueryLogFilterCombobox,
  type QueryLogFilter,
} from "./query-log-filter-combobox";
import { toast } from "sonner";
import { usePrefetchAdjacentPages } from "~/hooks/use-prefetch-adjacent-pages";

const serverColumns: typeof columns = [
  { accessorKey: "hostname", header: "Server" },
  ...columns,
];

export function QueryLogs({
  showServerColumn = false,
}: {
  showServerColumn?: boolean;
}) {
  const dashboard = useDashboardServers();
  const serverIds = dashboard.selection.selected("view");
  const scopeKey = serverIds.join(",");
  const [pageState, setPageState] = useState({ scopeKey, page: 0 });
  const pageIndex = pageState.scopeKey === scopeKey ? pageState.page : 0;
  const setPageIndex = (page: number) => setPageState({ scopeKey, page });
  const [filter, setFilter] = useState<QueryLogFilter>(null);
  const [responseTypeFilter, setResponseTypeFilter] = useState("ALL");
  const [questionTypeFilter, setQuestionTypeFilter] = useState("ALL");
  const [pageSize, setPageSize] = useState(10);
  const [autoRefresh, setAutoRefresh] = useState(true);

  const handleFilterChange = (value: QueryLogFilter) => {
    setFilter(value);
    setPageIndex(0);
  };

  const handleResponseTypeChange = (value: string) => {
    setResponseTypeFilter(value);
    setPageIndex(0);
  };

  const handleQuestionTypeChange = (value: string) => {
    setQuestionTypeFilter(value);
    setPageIndex(0);
  };

  const search = filter?.type === "domain" ? filter.value : undefined;
  const client = filter?.type === "client" ? filter.value : undefined;
  const responseType = isResponseType(responseTypeFilter)
    ? responseTypeFilter
    : undefined;
  const questionType = isDnsRecordType(questionTypeFilter)
    ? questionTypeFilter
    : undefined;
  const searchParams = {
    search,
    client,
    limit: pageSize,
    offset: pageIndex * pageSize,
    responseType,
    questionType,
  };

  const rows = api.logs.rows.useQuery(
    { ...searchParams, limit: pageSize + 1, serverIds },
    {
      refetchOnWindowFocus: autoRefresh,
      refetchInterval: autoRefresh ? 30_000 : false,
    },
  );
  const count = api.logs.count.useQuery(
    { search, client, responseType, questionType, serverIds },
    {
      refetchOnWindowFocus: autoRefresh,
      refetchInterval: autoRefresh ? 30_000 : false,
    },
  );
  useLogDiagnostics("rows", rows.data?.diagnostics);
  useLogDiagnostics("count", count.data?.diagnostics);
  const queryLogsData = rows.data && {
    items: rows.data.items.slice(0, pageSize).map((item) => ({
      ...item,
      hostname:
        dashboard.servers.find((server) => server.id === item.serverId)?.name ??
        "Unknown",
    })),
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
  const refetch = () => Promise.all([rows.refetch(), count.refetch()]);
  const hasNextPage = (rows.data?.items.length ?? 0) > pageSize;

  const handleAutoRefreshChange = (enabled: boolean) => {
    setAutoRefresh(enabled);
    if (enabled) {
      void refetch();
    }
  };

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

  const pageCount =
    queryLogsData?.totalCount === undefined
      ? undefined
      : Math.ceil(queryLogsData.totalCount / pageSize);
  const showLogsLoading = isLoadingLogs || isPlaceholderLogs;
  const utils = api.useUtils();

  usePrefetchAdjacentPages({
    enabled: !isFetchingLogs && queryLogsData !== undefined,
    currentPage: pageIndex,
    totalPages: pageCount ?? 0,
    prefetchPage: (targetPage) => {
      void utils.logs.rows.prefetch({
        ...searchParams,
        serverIds,
        limit: pageSize + 1,
        offset: targetPage * pageSize,
      });
    },
  });

  return (
    <Card>
      <CardHeader>
        <div className="flex w-full flex-row items-center justify-between">
          <div className="flex min-w-0 flex-1 flex-col gap-1">
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
                className="text-muted-foreground text-sm"
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
                  size="icon"
                  onClick={() => refetch()}
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
              <SelectTrigger className="w-full sm:w-36">
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
              <SelectTrigger className="w-full sm:w-28">
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
      <CardContent>
        <DataTable
          columns={showServerColumn ? serverColumns : columns}
          data={queryLogsData?.items ?? []}
          pageCount={pageCount}
          hasNextPage={hasNextPage}
          pageIndex={pageIndex}
          onPageChange={setPageIndex}
          pageSize={pageSize}
          onPageSizeChange={setPageSize}
          isLoading={showLogsLoading}
        />
      </CardContent>
    </Card>
  );
}
