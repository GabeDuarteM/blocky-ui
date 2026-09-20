import { expect, test } from "@playwright/test";
import { getQueryLogs } from "./query-logs";

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await expect(
    page.getByRole("region", { name: "Blocking Status" }).getByText("Enabled", {
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Total", exact: true }),
  ).toBeVisible();
  const logs = getQueryLogs(page);
  await expect(logs.entries).toHaveAttribute("aria-busy", "false");
  await expect(logs.rows).toHaveCount(10);
  await expect(
    page.getByText("12 ms avg. response", { exact: true }),
  ).toBeVisible();
  await expect(page.getByText(/^1-5 of \d+$/)).toHaveCount(2);
});

test("dashboard matches the full-page baseline", async ({ page }) => {
  await expect(page).toHaveScreenshot("dashboard.png", {
    fullPage: true,
    timeout: 15_000,
  });
});

test("DNS query results match the full-page baseline", async ({ page }) => {
  await page
    .getByRole("textbox", { name: "Domain to query" })
    .fill("example.com");
  await page.getByRole("button", { name: "Query", exact: true }).click();
  await expect(page.getByText("93.184.216.34", { exact: true })).toBeVisible();
  await page
    .getByRole("heading", { name: "> BlockyUI" })
    .scrollIntoViewIfNeeded();
  await page.mouse.move(0, 0);
  await expect(page).toHaveScreenshot("dns-query.png", {
    fullPage: true,
    timeout: 15_000,
  });
});
