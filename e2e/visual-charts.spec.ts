const lineThroughPattern = /line-through/;

import { expect, test } from "@playwright/test";
import {
  capture,
  capturePage,
  card,
  overrideRpc,
  popover,
  ready,
} from "./visual-support";

test.use({ reducedMotion: "reduce", deviceScaleFactor: 1 });
test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await ready(page);
});

test("chart filter suggestions and active filter", async ({ page }) => {
  const chart = card(page, "Queries over time");
  await chart.getByRole("button", { name: "Filter chart" }).click();
  await expect(
    popover(page).getByText("Domains", { exact: true }),
  ).toBeVisible();
  await capture(popover(page), "chart-filter-suggestions");
  await popover(page)
    .getByRole("option")
    .filter({ hasText: "github.com" })
    .click();
  await expect(
    chart.getByText("Domain: github.com", { exact: true }),
  ).toBeVisible();
  await expect(
    chart.getByRole("button", { name: "Filter chart" }),
  ).toBeFocused();
  await chart.getByRole("button", { name: "Cached", exact: true }).click();
  await expect(
    chart.getByRole("button", { name: "Cached", exact: true }),
  ).toHaveClass(lineThroughPattern);
  await chart.getByRole("button", { name: "Cached", exact: true }).blur();
  await page.mouse.move(0, 0);
  await expect(chart.locator(".recharts-tooltip-wrapper")).toBeHidden();
  await capturePage(page, "chart-filtered-series");
  await chart.getByRole("button", { name: "Filter chart" }).click();
  await popover(page).getByRole("combobox").fill("no-such-domain.invalid");
  await expect(popover(page).getByText("No results found.")).toBeVisible();
  await capture(popover(page), "chart-filter-empty");
});

for (const range of ["7d", "30d"] as const) {
  test(`chart ${range} axis labels`, async ({ page }) => {
    const chart = card(page, "Queries over time");
    await chart.getByRole("button", { name: range, exact: true }).click();
    await expect(
      chart.getByRole("button", { name: "Total", exact: true }),
    ).toBeVisible();
    await page.mouse.move(0, 0);
    await capture(chart, `chart-${range}`);
  });
}

test("chart hover tooltip", async ({ page, isMobile }) => {
  // biome-ignore lint/suspicious/noSkippedTests: Touch devices do not have a hover state.
  test.skip(isMobile, "Chart hover is covered on desktop.");
  const chart = card(page, "Queries over time");
  await chart
    .locator(".recharts-wrapper")
    .hover({ position: { x: 250, y: 100 } });
  await capture(chart.locator(".recharts-tooltip-wrapper"), "chart-tooltip");
});

test("blocked top list and details", async ({ page, isMobile }) => {
  const domains = card(page, "Top Domains");
  await domains.getByRole("button", { name: "Blocked", exact: true }).click();
  await expect(
    domains.getByRole("button", { name: "Blocked", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await expect(domains.locator('[data-slot="skeleton"]')).toHaveCount(0);
  await page.mouse.move(0, 0);
  await capture(domains, "top-list-blocked");
  if (!isMobile) {
    await domains.getByText("ads.facebook.com", { exact: true }).hover();
    const details = page.locator(
      "body > div.fixed.pointer-events-none.bg-popover",
    );
    await expect(details).toBeVisible();
    await capture(details, "top-list-blocked-details");
    await page.mouse.move(0, 0);
    await card(page, "Top Clients")
      .getByText("192.168.1.101", { exact: true })
      .hover();
    await expect(details).toBeVisible();
    await capture(details, "top-list-details");
  }
});

test("top list with no pagination", async ({ page }) => {
  await overrideRpc(page, {
    "logs.topList": {
      data: {
        items: [
          {
            name: "a-very-long-domain-name.for-the-production-network.example.com",
            count: 12_345,
            blocked: 345,
            percentage: 100,
          },
        ],
        totalCount: 1,
        diagnostics: [],
      },
    },
  });
  const domains = card(page, "Top Domains");
  await domains.getByRole("button", { name: "Blocked", exact: true }).click();
  await expect(
    domains.getByText(
      "a-very-long-domain-name.for-the-production-network.example.com",
    ),
  ).toBeVisible();
  await expect(
    domains.getByRole("group", { name: "Top Domains pagination" }),
  ).toHaveCount(0);
  await capture(domains, "top-list-single-page");
});
