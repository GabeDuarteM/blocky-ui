"use client";

import {
  type ColumnDef,
  type CoreFeatures,
  coreFeatures,
  flexRender,
  type RowData,
  useTable,
} from "@tanstack/react-table";
import type { ReactNode } from "react";
import { useCallback } from "react";
import { PaginationControls } from "~/components/dashboard/pagination-controls";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { Skeleton } from "~/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/table";
import { cn } from "~/lib/utils";

interface DataTableProps<TData extends RowData> {
  columns: ColumnDef<CoreFeatures, TData>[];
  data: TData[];
  getRowId: (entry: TData) => string;
  pageCount?: number;
  hasNextPage?: boolean;
  pageIndex: number;
  onPageChange: (pageIndex: number) => void;
  pageSize: number;
  onPageSizeChange: (pageSize: number) => void;
  isLoading: boolean;
  renderMobileRow?: (entry: TData) => ReactNode;
}

export function DataTable<TData extends RowData>({
  columns,
  data,
  getRowId,
  pageCount,
  hasNextPage = false,
  pageIndex,
  onPageChange,
  pageSize,
  onPageSizeChange,
  isLoading,
  renderMobileRow,
}: DataTableProps<TData>) {
  const handlePageSizeChange = useCallback(
    (value: string) => {
      onPageSizeChange(Number(value));
      onPageChange(0);
    },
    [onPageSizeChange, onPageChange],
  );

  const table = useTable({
    features: coreFeatures,
    data,
    columns,
    getRowId,
  });

  function renderDesktopRows() {
    if (isLoading) {
      return Array.from({ length: pageSize }, (_, index) => `row-${index}`).map(
        (key) => (
          <TableRow key={key} className="h-12">
            {table.getAllLeafColumns().map((column) => (
              <TableCell key={column.id}>
                <Skeleton className="h-4 w-full" />
              </TableCell>
            ))}
          </TableRow>
        ),
      );
    }
    if (table.getRowModel().rows?.length === 0) {
      return (
        <TableRow>
          <TableCell colSpan={columns.length} className="h-24 text-center">
            No results found.
          </TableCell>
        </TableRow>
      );
    }
    return table.getRowModel().rows.map((row) => (
      <TableRow key={row.id} className="h-12">
        {row.getAllCells().map((cell) => (
          <TableCell key={cell.id}>
            {flexRender(cell.column.columnDef.cell, cell.getContext())}
          </TableCell>
        ))}
      </TableRow>
    ));
  }
  function renderMobileRows() {
    if (!renderMobileRow) {
      return null;
    }
    if (isLoading) {
      return Array.from({ length: pageSize }, (_, index) => `row-${index}`).map(
        (key) => (
          <li
            key={key}
            className="flex h-19 items-center gap-3 px-3"
            aria-hidden="true"
          >
            <Skeleton className="h-11 w-21 shrink-0" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-4/5" />
              <Skeleton className="h-3 w-3/5" />
            </div>
          </li>
        ),
      );
    }
    if (data.length === 0) {
      return <li className="py-8 text-center text-sm">No results found.</li>;
    }
    return data.map((entry) => (
      <li key={getRowId(entry)}>{renderMobileRow(entry)}</li>
    ));
  }
  return (
    <div id="query-logs-table">
      {renderMobileRow ? (
        <ul
          aria-label="Query log entries"
          className="divide-y divide-border/60 overflow-hidden rounded-xl border bg-card/30 md:hidden"
          aria-busy={isLoading}
        >
          {renderMobileRows()}
        </ul>
      ) : null}
      <div
        className={cn(
          "rounded-md border",
          renderMobileRow && "hidden md:block",
        )}
      >
        <div className="overflow-y-auto">
          <Table aria-label="Query logs" aria-busy={isLoading}>
            <TableHeader>
              {table.getHeaderGroups().map((headerGroup) => (
                <TableRow key={headerGroup.id}>
                  {headerGroup.headers.map((header) => (
                    <TableHead key={header.id}>
                      {header.isPlaceholder
                        ? null
                        : flexRender(
                            header.column.columnDef.header,
                            header.getContext(),
                          )}
                    </TableHead>
                  ))}
                </TableRow>
              ))}
            </TableHeader>
            <TableBody aria-label="Query log entries" aria-busy={isLoading}>
              {renderDesktopRows()}
            </TableBody>
          </Table>
        </div>
      </div>
      <div className="-mx-6 mt-4 flex flex-wrap items-center justify-between gap-3 px-4 pt-4 sm:px-6">
        <div className="shrink-0">
          <Select
            value={pageSize.toString()}
            onValueChange={handlePageSizeChange}
          >
            <SelectTrigger
              aria-label="Rows per page"
              size="responsive"
              className="w-auto min-w-24"
            >
              <SelectValue>{pageSize} rows</SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="10">10</SelectItem>
              <SelectItem value="20">20</SelectItem>
              <SelectItem value="50">50</SelectItem>
              <SelectItem value="100">100</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <PaginationControls
          label="Query log pagination"
          pageIndex={pageIndex}
          pageCount={pageCount}
          hasNextPage={hasNextPage}
          onPageChange={onPageChange}
        />
      </div>
    </div>
  );
}
