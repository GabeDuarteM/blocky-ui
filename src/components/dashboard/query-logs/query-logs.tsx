"use client";

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
import { useState, useEffect } from "react";
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
} from "~/lib/constants";
import {
  QueryLogFilterCombobox,
  type QueryLogFilter,
} from "./query-log-filter-combobox";
import { toast } from "sonner";

export function QueryLogs() {
  const [filter, setFilter] = useState<QueryLogFilter>(null);
  const [pageIndex, setPageIndex] = useState(0);
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

  const searchParams = {
    search: filter?.type === "domain" ? filter.value : undefined,
    client: filter?.type === "client" ? filter.value : undefined,
    limit: pageSize,
    offset: pageIndex * pageSize,
    responseType: responseTypeFilter !== "ALL" ? responseTypeFilter : undefined,
    questionType: isDnsRecordType(questionTypeFilter)
      ? questionTypeFilter
      : undefined,
  };

  const {
    data: queryLogsData,
    isFetching: isFetchingLogs,
    refetch,
    error,
  } = api.blocky.getQueryLogs.useQuery(searchParams, {
    placeholderData: (previousData) => ({
      items: [],
      totalCount: previousData?.totalCount ?? 0,
    }),
    refetchOnWindowFocus: autoRefresh,
    refetchInterval: autoRefresh ? 30_000 : false,
  });

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

  const pageCount = Math.ceil((queryLogsData?.totalCount ?? 0) / pageSize);
  const utils = api.useUtils();

  if (pageIndex > 0) {
    void utils.blocky.getQueryLogs.prefetch({
      ...searchParams,
      offset: (pageIndex - 1) * pageSize,
    });
  }

  if (pageIndex < pageCount - 1) {
    void utils.blocky.getQueryLogs.prefetch({
      ...searchParams,
      offset: (pageIndex + 1) * pageSize,
    });
  }

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
        <div className="mt-4 flex flex-row items-center gap-2">
          <QueryLogFilterCombobox
            value={filter}
            onChange={handleFilterChange}
          />
          <Select
            value={responseTypeFilter}
            onValueChange={handleResponseTypeChange}
          >
            <SelectTrigger className="w-36">
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
            <SelectTrigger className="w-28">
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
      </CardHeader>
      <CardContent>
        <DataTable
          columns={columns}
          data={queryLogsData?.items ?? []}
          pageCount={pageCount}
          pageIndex={pageIndex}
          onPageChange={setPageIndex}
          pageSize={pageSize}
          onPageSizeChange={setPageSize}
          isLoading={isFetchingLogs}
        />
      </CardContent>
    </Card>
  );
}
