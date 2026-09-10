import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { DataTable } from "~/components/dashboard/query-logs/data-table";

function renderTable(pageCount: number, hasNextPage: boolean, pageIndex = 0) {
  return renderToStaticMarkup(
    createElement(DataTable, {
      columns: [{ accessorKey: "id", header: "ID" }],
      data: Array.from({ length: 10 }, (_, id) => ({ id })),
      pageCount,
      hasNextPage,
      pageIndex,
      onPageChange: () => undefined,
      pageSize: 10,
      onPageSizeChange: () => undefined,
      isLoading: false,
    }),
  );
}

function renderNextButton(pageCount: number, hasNextPage: boolean) {
  const html = renderTable(pageCount, hasNextPage);
  const button = html.match(/<button[^>]*aria-label="Next page"[^>]*>/)?.[0];

  if (!button) {
    throw new Error("Next page button was not rendered");
  }

  return button;
}

describe("query log pagination with a cached total", () => {
  it("hides a stale total when the current page exceeds it", () => {
    const html = renderTable(1, false, 1);

    expect(html).toMatch(/<span[^>]*>2<\/span>/);
    expect(html).not.toContain(" / ");
  });

  it("hides a stale total when lookahead proves another page exists", () => {
    const html = renderTable(1, true);

    expect(html).toMatch(/<span[^>]*>1<\/span>/);
    expect(html).not.toContain(" / ");
  });

  it("shows page totals again when the count catches up", () => {
    expect(renderTable(2, false, 1)).toContain("2 / 2");
  });

  it("allows the next page when fresh rows extend beyond the cached total", () => {
    expect(renderNextButton(1, true)).not.toContain(" disabled=");
  });

  it("disables the next page when fresh rows end before the cached total", () => {
    expect(renderNextButton(2, false)).toContain(" disabled=");
  });
});
