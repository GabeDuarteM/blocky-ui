"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "~/components/ui/button";
import { PageNumbers } from "~/components/ui/page-numbers";

export function PaginationControls({
  pageIndex,
  pageCount,
  hasNextPage,
  onPageChange,
  label,
}: {
  pageIndex: number;
  pageCount?: number;
  hasNextPage: boolean;
  onPageChange: (page: number) => void;
  label: string;
}) {
  const showPageCount =
    pageCount !== undefined &&
    pageIndex < Math.max(1, pageCount) &&
    hasNextPage === pageIndex < pageCount - 1;

  return (
    <div
      role="group"
      aria-label={label}
      className="ml-auto flex shrink-0 items-center"
    >
      <Button
        variant="outline"
        size="responsive-icon"
        groupPosition="first"
        aria-label="Previous page"
        onClick={() => onPageChange(pageIndex - 1)}
        disabled={pageIndex === 0}
      >
        <ChevronLeft />
      </Button>
      <PageNumbers
        grouped
        currentPage={pageIndex}
        totalPages={showPageCount ? pageCount || 1 : undefined}
        onPageChange={onPageChange}
      />
      <Button
        variant="outline"
        size="responsive-icon"
        groupPosition="last"
        aria-label="Next page"
        onClick={() => onPageChange(pageIndex + 1)}
        disabled={!hasNextPage}
      >
        <ChevronRight />
      </Button>
    </div>
  );
}
