"use client";

import { api } from "~/trpc/react";
import { History, Search, RefreshCw } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import { Input } from "~/components/ui/input";
import { Button } from "~/components/ui/button";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from "~/components/ui/tooltip";
import { useState, useEffect } from "react";
import { useDebounce } from "~/hooks/use-debounce";
import { DataTable } from "./data-table";
import { columns } from "./columns";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";

const BLOCKY_RESPONSE_TYPES = [
  "BLOCKED",
  "RESOLVED",
  "CACHED",
  "CUSTOMDNS",
  "SPECIAL",
];

export function QueryLogs() {
  const [searchQuery, setSearchQuery] = useState("");
  const debouncedSearch = useDebounce(searchQuery, 300);
  const [pageIndex, setPageIndex] = useState(0);
  const [responseTypeFilter, setResponseTypeFilter] = useState("ALL");
  const pageSize = 10;

  useEffect(() => {
    setPageIndex(0);
  }, [debouncedSearch, responseTypeFilter]);

  const searchParams = {
    search: debouncedSearch,
    limit: pageSize,
    offset: pageIndex * pageSize,
    responseType: responseTypeFilter !== "ALL" ? responseTypeFilter : undefined,
  };

  const {
    data: queryLogsData,
    isFetching: isFetchingLogs,
    refetch,
  } = api.blocky.getQueryLogs.useQuery(searchParams, {
    placeholderData: (previousData) => ({
      items: [],
      totalCount: previousData?.totalCount ?? 0,
    }),
  });

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
          <div className="flex h-full items-center justify-center pl-4">
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
        <div className="mt-4">
          <div className="relative flex flex-row items-center gap-2">
            <div className="relative flex-1">
              <Search className="text-muted-foreground absolute top-2.5 left-2 h-4 w-4" />
              <Input
                placeholder="Search domains..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-8"
              />
            </div>
            <Select
              value={responseTypeFilter}
              onValueChange={setResponseTypeFilter}
            >
              <SelectTrigger className="w-36">
                <SelectValue placeholder="Response Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All Types</SelectItem>
                {BLOCKY_RESPONSE_TYPES.map((type) => (
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
          columns={columns}
          data={queryLogsData?.items ?? []}
          pageCount={pageCount}
          pageIndex={pageIndex}
          onPageChange={setPageIndex}
          isLoading={isFetchingLogs}
        />
      </CardContent>
    </Card>
  );
}
