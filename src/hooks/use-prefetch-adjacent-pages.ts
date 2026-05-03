import { useEffect } from "react";

interface UsePrefetchAdjacentPagesOptions {
  enabled: boolean;
  currentPage: number;
  totalPages: number;
  prefetchPage: (page: number) => void;
}

export function usePrefetchAdjacentPages({
  enabled,
  currentPage,
  totalPages,
  prefetchPage,
}: UsePrefetchAdjacentPagesOptions) {
  useEffect(() => {
    if (!enabled) {
      return;
    }

    const pages: number[] = [];

    if (currentPage > 0) {
      pages.push(currentPage - 1);
    }

    if (currentPage < totalPages - 1) {
      pages.push(currentPage + 1);
    }

    if (pages.length === 0) {
      return;
    }

    const run = () => {
      for (const page of pages) {
        prefetchPage(page);
      }
    };

    if (window.requestIdleCallback) {
      const idleId = window.requestIdleCallback(run);
      return () => window.cancelIdleCallback(idleId);
    }

    const timeoutId = window.setTimeout(run, 0);
    return () => window.clearTimeout(timeoutId);
  }, [currentPage, enabled, prefetchPage, totalPages]);
}
