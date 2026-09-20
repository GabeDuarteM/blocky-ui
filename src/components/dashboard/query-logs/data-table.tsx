"use client";

import { useId } from "react";

import {
  flexRender,
  coreFeatures,
  useTable,
  type ColumnDef,
  type CoreFeatures,
  type RowData,
} from "@tanstack/react-table";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { Skeleton } from "~/components/ui/skeleton";
import { Button } from "~/components/ui/button";
import { PageNumbers } from "~/components/ui/page-numbers";
import { ChevronLeft, ChevronRight } from "lucide-react";

interface DataTableProps<TData extends RowData> {
  columns: ColumnDef<CoreFeatures, TData>[];
  data: TData[];
  pageCount?: number;
  hasNextPage?: boolean;
  pageIndex: number;
  onPageChange: (pageIndex: number) => void;
  pageSize: number;
  onPageSizeChange: (pageSize: number) => void;
  isLoading: boolean;
}

export function DataTable<TData extends RowData>({
  columns,
  data,
  pageCount,
  hasNextPage = false,
  pageIndex,
  onPageChange,
  pageSize,
  onPageSizeChange,
  isLoading,
}: DataTableProps<TData>) {
  const tableId = useId();
  const showPageCount =
    pageCount !== undefined &&
    pageIndex < Math.max(1, pageCount) &&
    hasNextPage === pageIndex < pageCount - 1;

  const handlePageSizeChange = (value: string) => {
    onPageSizeChange(Number(value));
    onPageChange(0);
  };

  const table = useTable({
    features: coreFeatures,
    data,
    columns,
  });

  return (
    <div>
      <div className="rounded-md border">
        <div className="overflow-y-auto">
          <Table aria-label="Query logs" aria-busy={isLoading}>
            <TableHeader>
              {table.getHeaderGroups().map((headerGroup) => (
                <TableRow key={headerGroup.id}>
                  {headerGroup.headers.map((header) => {
                    return (
                      <TableHead
                        key={header.id}
                        id={`${tableId}-${header.column.id}`}
                      >
                        {header.isPlaceholder
                          ? null
                          : flexRender(
                              header.column.columnDef.header,
                              header.getContext(),
                            )}
                      </TableHead>
                    );
                  })}
                </TableRow>
              ))}
            </TableHeader>
            <TableBody aria-label="Query log entries">
              {isLoading ? (
                Array.from({ length: pageSize }, (_, index) => (
                  <TableRow key={index} className="h-12">
                    {table.getAllLeafColumns().map((column) => (
                      <TableCell key={column.id}>
                        <Skeleton className="h-4 w-full" />
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              ) : table.getRowModel().rows?.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={columns.length}
                    className="h-24 text-center"
                  >
                    No results found.
                  </TableCell>
                </TableRow>
              ) : (
                table.getRowModel().rows.map((row) => (
                  <TableRow key={row.id} className="h-12">
                    {row.getAllCells().map((cell) => (
                      <TableCell
                        key={cell.id}
                        id={`${tableId}-${cell.id}`}
                        aria-labelledby={`${tableId}-${cell.column.id} ${tableId}-${cell.id}`}
                      >
                        {flexRender(
                          cell.column.columnDef.cell,
                          cell.getContext(),
                        )}
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>
      <div className="-mx-6 mt-4 flex flex-col-reverse items-center justify-between gap-4 border-t px-6 pt-4 md:flex-row">
        <div className="flex items-center gap-2">
          <span className="text-muted-foreground text-xs">Rows</span>
          <Select
            value={pageSize.toString()}
            onValueChange={handlePageSizeChange}
          >
            <SelectTrigger
              aria-label="Rows per page"
              size="sm"
              className="h-7 w-18 text-xs"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="10">10</SelectItem>
              <SelectItem value="20">20</SelectItem>
              <SelectItem value="50">50</SelectItem>
              <SelectItem value="100">100</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="outline"
            size="icon"
            className="h-7 w-7"
            aria-label="Previous page"
            onClick={() => onPageChange(pageIndex - 1)}
            disabled={pageIndex === 0}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          {!showPageCount ? (
            <span className="px-3 text-xs tabular-nums">{pageIndex + 1}</span>
          ) : (
            <PageNumbers
              currentPage={pageIndex}
              totalPages={pageCount || 1}
              onPageChange={onPageChange}
            />
          )}
          <Button
            variant="outline"
            size="icon"
            className="h-7 w-7"
            aria-label="Next page"
            onClick={() => onPageChange(pageIndex + 1)}
            disabled={!hasNextPage}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
