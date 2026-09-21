import { expect, test } from "@playwright/test";
import { getQueryLogs } from "./query-logs";
import { logEntries, longDomain } from "./visual-data";
import {
  capture,
  closePopup,
  configureDemo,
  holdRpc,
  overrideRpc,
  ready,
  tooltip,
} from "./visual-support";

test.use({ reducedMotion: "reduce", deviceScaleFactor: 1 });

test("log search suggestions and selected filter", async ({ page }) => {
  await page.goto("/");
  await ready(page);
  const logs = getQueryLogs(page);
  await logs.region
    .getByRole("switch", { name: "Auto", exact: true })
    .uncheck();
  const input = logs.region.getByRole("combobox", {
    name: "Filter query logs",
  });
  await input.fill("google");
  const popup = page.locator('[data-slot="combobox-content"]');
  await expect(
    popup.getByRole("option").filter({ hasText: "google.com" }).first(),
  ).toBeVisible();
  await expect(popup.getByRole("listbox")).toHaveAttribute(
    "aria-busy",
    "false",
  );
  await capture(popup, "log-search-suggestions");
  await popup
    .getByRole("option")
    .filter({ has: page.getByText("google.com", { exact: true }) })
    .click();
  await expect(logs.entries).toHaveAttribute("aria-busy", "false");
  await expect(input).toHaveValue("google.com");
  await capture(
    logs.region.locator('[data-slot="card-header"]'),
    "log-filter-selected",
  );
});

test("log search loading", async ({ page }) => {
  await page.goto("/");
  await ready(page);
  const release = await holdRpc(page, "logs.search");
  try {
    await getQueryLogs(page)
      .region.getByRole("combobox", { name: "Filter query logs" })
      .fill("collector");
    const popup = page.locator('[data-slot="combobox-content"]');
    await expect(popup.getByText("Searching...")).toBeVisible();
    await capture(popup, "log-search-loading");
  } finally {
    release();
  }
});

test("log search without suggestions", async ({ page }) => {
  await overrideRpc(page, {
    "logs.topList": { data: { items: [], totalCount: 0, diagnostics: [] } },
  });
  await page.goto("/");
  await expect(getQueryLogs(page).entries).toHaveAttribute(
    "aria-busy",
    "false",
  );
  await getQueryLogs(page)
    .region.getByRole("combobox", { name: "Filter query logs" })
    .click();
  const popup = page.locator('[data-slot="combobox-content"]');
  await expect(popup.getByText("No suggestions found.")).toBeVisible();
  await capture(popup, "log-search-empty");
});

test("short and long select menus", async ({ page }) => {
  await page.goto("/");
  await ready(page);
  await page
    .getByRole("combobox", { name: "DNS record type", exact: true })
    .click();
  await capture(page.getByRole("listbox"), "record-type-menu");
  await closePopup(
    page.getByRole("combobox", { name: "DNS record type", exact: true }),
  );
  await page.getByRole("combobox", { name: "Filter by reason" }).click();
  await capture(page.getByRole("listbox"), "reason-menu");
  await closePopup(page.getByRole("combobox", { name: "Filter by reason" }));
  await page
    .getByRole("combobox", { name: "Rows per page", exact: true })
    .click();
  await capture(page.getByRole("listbox"), "page-size-menu");
});

test("log edge cases and expanded mobile details", async ({
  page,
  isMobile,
}) => {
  await overrideRpc(page, {
    "logs.rows": { data: { items: logEntries, diagnostics: [] } },
    "logs.count": { data: { totalCount: logEntries.length, diagnostics: [] } },
  });
  await page.goto("/");
  await configureDemo(page);
  const logs = getQueryLogs(page);
  await expect(logs.rows).toHaveCount(3);
  await expect(logs.entries).toHaveAttribute("aria-busy", "false");
  if (isMobile) {
    const entries = logs.region.locator("details");
    for (const entry of await entries.all()) {
      await entry.locator("summary").click();
    }
    await expect(
      logs.region.getByText("Unknown time", { exact: true }),
    ).toBeVisible();
    await expect(
      entries.first().getByText(longDomain, { exact: true }),
    ).toHaveCount(2);
    await capture(logs.entries, "mobile-log-details");
  } else {
    await capture(logs.entries.locator(".."), "log-edge-cases");
    await logs.entries.getByText(longDomain, { exact: true }).hover();
    await capture(tooltip(page), "log-domain-tooltip");
    await page.mouse.move(0, 0);
    await logs.entries
      .getByRole("button", { name: /RESOLVED: Resolved by:/ })
      .hover();
    await capture(tooltip(page), "log-reason-tooltip");
  }
});

test("editable and unknown-total pagination", async ({ page }) => {
  await page.goto("/");
  await ready(page);
  const logs = getQueryLogs(page);
  await logs.region
    .getByRole("switch", { name: "Auto", exact: true })
    .uncheck();
  const pagination = logs.region.getByRole("group", {
    name: "Query log pagination",
  });
  await pagination.getByRole("button", { name: "1 / 20", exact: true }).click();
  await expect(pagination.getByRole("spinbutton")).toBeFocused();
  await capture(pagination, "pagination-editing");
  await page.keyboard.press("Escape");
  await overrideRpc(page, {
    "logs.count": {
      data: {
        totalCount: 200,
        diagnostics: [
          { sourceId: "archive", message: "Unable to read this log source." },
        ],
      },
    },
  });
  await logs.region
    .getByRole("button", { name: "Refresh", exact: true })
    .click();
  await expect(
    pagination.getByLabel("Page 1, total pages unavailable"),
  ).toBeVisible();
  await capture(pagination, "pagination-unknown-total");
});

test("ordinary explanatory tooltip", async ({ page, isMobile }) => {
  test.skip(isMobile, "Shared hover tooltip is covered on desktop.");
  await page.goto("/");
  await ready(page);
  await page.getByText("Cache Hit Rate", { exact: true }).hover();
  await capture(tooltip(page), "statistics-tooltip");
});
