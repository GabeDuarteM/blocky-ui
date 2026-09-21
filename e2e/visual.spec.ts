import { expect, test } from "@playwright/test";
import { getQueryLogs } from "./query-logs";
import { ready } from "./visual-support";

test.use({ reducedMotion: "reduce" });

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await expect(
    page.getByRole("region", { name: "Blocking Status" }).getByText("Enabled", {
      exact: true,
    }),
  ).toBeVisible();
  await ready(page);
  await expect(getQueryLogs(page).rows).toHaveCount(10);
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
