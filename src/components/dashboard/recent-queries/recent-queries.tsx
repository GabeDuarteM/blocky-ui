"use client";

import { api } from "~/trpc/react";
import { History, Search } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import { Input } from "~/components/ui/input";
import { useState, useEffect } from "react";
import { useDebounce } from "~/hooks/use-debounce";
import { DataTable } from "./data-table";
import { columns } from "./columns";

export function RecentQueries() {
  const [searchQuery, setSearchQuery] = useState("");
  const debouncedSearch = useDebounce(searchQuery, 300);
  const [pageIndex, setPageIndex] = useState(0);
  const pageSize = 10;

  useEffect(() => {
    setPageIndex(0);
  }, [debouncedSearch]);

  const searchParams = {
    search: debouncedSearch,
    limit: pageSize,
    offset: (pageIndex + 1) * pageSize,
  };

  const { data: logEntriesData, isFetching: isFetchingLogs } =
    api.blocky.getLogEntries.useQuery(searchParams, {
      placeholderData: (previousData) => ({
        items: [],
        totalCount: previousData?.totalCount ?? 0,
      }),
    });

  const pageCount = Math.ceil((logEntriesData?.totalCount ?? 0) / pageSize);
  const utils = api.useUtils();

  if (pageIndex > 0) {
    void utils.blocky.getLogEntries.prefetch({
      ...searchParams,
      offset: (pageIndex - 1) * pageSize,
    });
  }

  if (pageIndex < pageCount - 1) {
    void utils.blocky.getLogEntries.prefetch({
      ...searchParams,
      offset: (pageIndex + 1) * pageSize,
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <History className="h-5 w-5" />
          Recent DNS Queries
        </CardTitle>
        <CardDescription>
          View the most recent DNS queries processed by the server
        </CardDescription>
        <div className="mt-4">
          <div className="relative">
            <Search className="text-muted-foreground absolute top-2.5 left-2 h-4 w-4" />
            <Input
              placeholder="Search domains..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8"
            />
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <DataTable
          columns={columns}
          data={logEntriesData?.items ?? []}
          pageCount={pageCount}
          pageIndex={pageIndex}
          onPageChange={setPageIndex}
          isLoading={isFetchingLogs}
        />
      </CardContent>
    </Card>
  );
}
