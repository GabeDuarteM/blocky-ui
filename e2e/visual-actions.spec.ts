import { expect, type Page, test } from "@playwright/test";
import { queryResults, serverFailure } from "./visual-data";
import {
  capture,
  capturePage,
  card,
  configureDemo,
  holdRpc,
  overrideRpc,
  ready,
} from "./visual-support";

test.use({ reducedMotion: "reduce", deviceScaleFactor: 1 });

async function submitQuery(page: Page) {
  await page
    .getByRole("textbox", { name: "Domain to query" })
    .fill("example.com");
  await page.getByRole("button", { name: "Query", exact: true }).click();
}

test("DNS loading results", async ({ page }) => {
  await page.goto("/");
  await configureDemo(page);
  await ready(page);
  const release = await holdRpc(page, "servers.query");
  try {
    await submitQuery(page);
    await expect(
      page.getByRole("region", { name: "DNS query results", exact: true }),
    ).toHaveAttribute("aria-busy", "true");
    await expect(
      page.getByRole("button", { name: "Query", exact: true }),
    ).toBeDisabled();
    await page
      .getByRole("region", { name: "Query Tool", exact: true })
      .evaluate((element) => {
        element.scrollIntoView({ block: "start", behavior: "instant" });
      });
    await capturePage(page, "dns-loading", { fullPage: false });
  } finally {
    release();
  }
});

test("DNS blocked, long answers and failed results", async ({ page }) => {
  await overrideRpc(page, { "servers.query": { data: queryResults } });
  await page.goto("/");
  await configureDemo(page);
  await ready(page);
  await submitQuery(page);
  const results = page.getByRole("region", {
    name: "DNS query results",
    exact: true,
  });
  await expect(results).toHaveAttribute("aria-busy", "false");
  await expect(results.getByText("No answer returned")).toBeVisible();
  await expect(page.locator("[data-sonner-toast]")).toHaveCount(0, {
    timeout: 10_000,
  });
  await page.mouse.move(0, 0);
  await capturePage(page, "dns-multiple-results");
  const answerList = results.locator(".overflow-y-auto");
  await answerList.evaluate((element) => {
    element.scrollTop = element.scrollHeight;
  });
  await results.evaluate((element) => {
    element.scrollTop = element.scrollHeight;
  });
  await results.scrollIntoViewIfNeeded();
  await expect(
    results.getByText("The server did not respond in time."),
  ).toBeInViewport();
  await capturePage(page, "dns-results-scrolled");
});

test("maintenance pending controls", async ({ page }) => {
  await page.goto("/");
  await ready(page);
  const release = await holdRpc(page, "servers.command");
  try {
    const operations = card(page, "Operations");
    await operations.getByRole("button", { name: "Clear DNS Cache" }).click();
    await expect(
      operations.getByRole("button", { name: "Reload Allow/Denylists" }),
    ).toBeDisabled();
    await capture(operations, "operations-pending");
  } finally {
    release();
  }
});

test("success notification", async ({ page }) => {
  await page.goto("/");
  await ready(page);
  await page.getByRole("button", { name: "Clear DNS Cache" }).click();
  const toast = page.locator("[data-sonner-toast]");
  await expect(toast).toContainText("Completed on 1 server");
  await toast.hover();
  await capture(toast, "notification-success");
});

test("error notification with description", async ({ page }) => {
  await overrideRpc(page, {
    "servers.command": {
      error:
        "Unable to connect to the maintenance service. Check the server address and network connection before trying again.",
    },
  });
  await page.goto("/");
  await ready(page);
  await page.getByRole("button", { name: "Clear DNS Cache" }).click();
  const toast = page.locator("[data-sonner-toast]");
  await expect(toast).toContainText("Unable to complete the action");
  await toast.hover();
  await capture(toast, "notification-error");
});

test("partial success notifications with retry", async ({ page }) => {
  await overrideRpc(page, {
    "servers.command": {
      data: [
        { serverId: "default", success: true, data: { success: true } },
        serverFailure("demo-2"),
        serverFailure("demo-3"),
      ],
    },
  });
  await page.goto("/");
  await configureDemo(page);
  await ready(page);
  await page
    .getByRole("region", { name: "Blocking Status" })
    .getByRole("button", { name: "5 minutes", exact: true })
    .click();
  const toasts = page.locator("[data-sonner-toaster]");
  await expect(
    toasts.getByRole("button", { name: "Retry", exact: true }),
  ).toBeVisible();
  await expect(page.locator("[data-sonner-toast]")).toHaveCount(2);
  await toasts.getByRole("button", { name: "Retry", exact: true }).hover();
  await expect(
    page.locator('[data-sonner-toast][data-expanded="true"]'),
  ).toHaveCount(2);
  const clip = await page
    .locator("[data-sonner-toast]")
    .evaluateAll((elements) => {
      const boxes = elements.map((element) => element.getBoundingClientRect());
      const x = Math.min(...boxes.map((box) => box.x)) - 4;
      const y = Math.min(...boxes.map((box) => box.y)) - 4;
      return {
        x,
        y,
        width: Math.max(...boxes.map((box) => box.right)) - x + 4,
        height: Math.max(...boxes.map((box) => box.bottom)) - y + 4,
      };
    });
  await expect(page).toHaveScreenshot("notifications-stacked.png", {
    clip,
    animations: "disabled",
  });
});
