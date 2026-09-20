import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { DataTable } from "~/components/dashboard/query-logs/data-table";

function renderTable(
  pageCount: number | undefined,
  hasNextPage: boolean,
  pageIndex = 0,
) {
  return renderToStaticMarkup(
    createElement(DataTable<{ id: number }>, {
      columns: [{ accessorKey: "id", header: "ID" }],
      data: Array.from({ length: 10 }, (_, id) => ({ id })),
      getRowId: (entry) => String(entry.id),
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
  it("exposes the current page to assistive technology", () => {
    const html = renderTable(2, true);
    expect(html).toMatch(
      /<button[^>]*aria-current="page"[^>]*>1 \/ 2<\/button>/,
    );
    expect(renderTable(undefined, true)).not.toContain('aria-current="page"');
  });

  it("keeps a placeholder for the total before it is available", () => {
    const html = renderTable(undefined, true);
    expect(html).toContain("1 / …");
    expect(html).toContain('aria-label="Page 1, total pages unavailable"');
  });

  it("hides a stale total when the current page exceeds it", () => {
    const html = renderTable(1, false, 1);

    expect(html).toContain("2 / …");
    expect(html).not.toContain("2 / 1");
  });

  it("hides a stale total when lookahead proves another page exists", () => {
    const html = renderTable(1, true);

    expect(html).toContain("1 / …");
  });

  it("hides a stale total when fresh rows end before it", () => {
    const html = renderTable(2, false);

    expect(html).toContain("1 / …");
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

function renderMobileTable(data: { id: string }[], isLoading = false) {
  return renderToStaticMarkup(
    createElement(DataTable<{ id: string }>, {
      columns: [{ accessorKey: "id", header: "ID" }],
      data,
      getRowId: (entry) => entry.id,
      pageIndex: 0,
      onPageChange: () => undefined,
      pageSize: 10,
      onPageSizeChange: () => undefined,
      isLoading,
      renderMobileRow: (entry) =>
        createElement("details", null, `Mobile row ${entry.id}`),
    }),
  );
}

describe("mobile table states", () => {
  it("renders fresh entries with the supplied mobile row renderer", () => {
    expect(renderMobileTable([{ id: "fresh" }])).toContain("Mobile row fresh");
  });

  it("does not expose stale rows while the next page loads", () => {
    const html = renderMobileTable([{ id: "stale" }], true);
    expect(html).not.toContain("Mobile row stale");
    expect(html).toContain('aria-busy="true"');
  });

  it("shows the empty result without mobile rows", () => {
    const html = renderMobileTable([]);
    expect(html).toContain("No results found.");
    expect(html).not.toContain("<details");
  });
});
