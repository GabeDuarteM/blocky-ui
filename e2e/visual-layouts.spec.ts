import { expect, test } from "@playwright/test";
import { demoServers } from "~/demo/config";
import { getQueryLogs } from "./query-logs";
import {
  blockingStatus,
  emptyLogs,
  serverFailure,
  serverStatistics,
} from "./visual-data";
import {
  capture,
  capturePage,
  card,
  closePopup,
  configureDemo,
  holdRpc,
  overrideRpc,
  popover,
  ready,
} from "./visual-support";

test.use({ reducedMotion: "reduce", deviceScaleFactor: 1 });
test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(new Date("2026-01-15T12:00:00Z"));
});

test("multi-server dashboard and inventory", async ({ page }) => {
  await overrideRpc(page, {
    "servers.statistics": {
      data: demoServers(10).map((server, index) =>
        serverStatistics(server.id, index),
      ),
    },
  });
  await page.goto("/");
  await configureDemo(page, 10);
  await ready(page);
  await expect(
    page
      .getByRole("button", { name: /^Choose .* targets$/ })
      .filter({ hasText: "All 10 servers" }),
  ).toHaveCount(3);
  await capturePage(page, "multi-server");
  await page
    .getByRole("button", { name: "View listed domains by server" })
    .click();
  await expect(popover(page).getByRole("row")).toHaveCount(11);
  await capture(popover(page), "server-inventory");
});

test("server pickers and mixed blocking", async ({ page }) => {
  await overrideRpc(page, {
    "servers.blockingStatus": {
      data: [
        blockingStatus(true),
        blockingStatus(false, 300, "demo-2"),
        serverFailure("demo-3"),
      ],
    },
  });
  await page.goto("/");
  await configureDemo(page);
  await ready(page);
  const status = page.getByRole("region", { name: "Blocking Status" });
  await expect(status.getByText("Mixed", { exact: true })).toBeVisible();
  await capturePage(page, "blocking-mixed");
  await page.getByRole("button", { name: "Showing: All servers" }).click();
  await expect(
    popover(page).getByText("Unreachable", { exact: true }),
  ).toBeVisible();
  await capture(popover(page), "view-picker");
  await closePopup(page.getByRole("button", { name: "Showing: All servers" }));
  await page.getByRole("button", { name: "Choose Blocking targets" }).click();
  await page.getByRole("switch", { name: "Blocking targets: Home" }).uncheck();
  await page
    .getByRole("switch", { name: "Blocking targets: Backup" })
    .uncheck();
  await expect(
    page.getByRole("switch", { name: "Blocking targets: Office" }),
  ).toBeDisabled();
  await expect(status.getByText("Disabled", { exact: true })).toBeVisible();
  await status.evaluate((element) => {
    element.scrollIntoView({ block: "start", behavior: "instant" });
  });
  await capturePage(page, "blocking-picker", { fullPage: false });
  await page
    .getByRole("textbox", { name: "Search Blocking targets" })
    .fill("missing-server");
  await expect(popover(page).getByText("No matching servers")).toBeVisible();
  await capturePage(page, "server-picker-empty", { fullPage: false });
  await closePopup(
    page.getByRole("button", { name: "Choose Blocking targets" }),
  );
  await page
    .getByRole("region", { name: "Query Tool", exact: true })
    .evaluate((element) => {
      element.scrollIntoView({ block: "start", behavior: "instant" });
    });
  await page.getByRole("button", { name: "Choose Query targets" }).click();
  await expect(popover(page)).toBeVisible();
  await capturePage(page, "query-picker", { fullPage: false });
});

for (const [name, seconds] of [
  ["paused", 300],
  ["disabled", 0],
] as const) {
  test(`blocking ${name}`, async ({ page }) => {
    await overrideRpc(page, {
      "servers.blockingStatus": { data: [blockingStatus(false, seconds)] },
    });
    await page.goto("/");
    const status = page.getByRole("region", { name: "Blocking Status" });
    await expect(
      status.getByRole("button", { name: "Enable", exact: true }),
    ).toBeVisible();
    await capture(status, `blocking-${name}`);
  });
}

test("partial failures and unknown blocking", async ({ page }) => {
  await overrideRpc(page, {
    "servers.blockingStatus": {
      data: [
        blockingStatus(true),
        blockingStatus(true, 0, "demo-2"),
        serverFailure("demo-3"),
      ],
    },
    "servers.statistics": {
      data: [serverStatistics("default"), serverFailure("demo-2")],
    },
    "logs.count": {
      data: {
        totalCount: 200,
        diagnostics: [
          {
            sourceId: "archive-database",
            message: "Unable to read this log source.",
          },
        ],
      },
    },
  });
  await page.goto("/");
  await configureDemo(page);
  await expect(page.getByText("Statistics unavailable: Office")).toBeVisible();
  await expect(
    page.getByText("Log queries failed: archive-database"),
  ).toBeVisible();
  await expect(
    page
      .getByRole("region", { name: "Blocking Status" })
      .getByText("Unknown", { exact: true }),
  ).toBeVisible();
  await expect(getQueryLogs(page).entries).toHaveAttribute(
    "aria-busy",
    "false",
  );
  await capturePage(page, "partial-failures");
});

test("statistics request failure", async ({ page }) => {
  await overrideRpc(page, {
    "servers.statistics": { error: "Statistics service is unavailable" },
  });
  await page.goto("/");
  await expect(page.getByText("Unable to load server statistics.")).toBeVisible(
    { timeout: 15_000 },
  );
  await expect(page.getByText("Total Queries", { exact: true })).toHaveCount(0);
  await capture(
    page
      .getByRole("status")
      .filter({ hasText: "Unable to load server statistics" }),
    "statistics-error",
  );
});

test("statistics fallback without query logs", async ({ page }) => {
  await page.goto("/");
  await configureDemo(page, 3, false);
  await expect(
    page.getByText("12 ms avg. response", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("connectivitycheck.gstatic.com", { exact: true }),
  ).toBeVisible();
  await expect(getQueryLogs(page).region).toHaveCount(0);
  await capturePage(page, "statistics-fallback");
  await page.getByRole("combobox", { name: "Top lists server" }).click();
  await capture(page.getByRole("listbox"), "fallback-server-menu");
  await closePopup(page.getByRole("combobox", { name: "Top lists server" }));
  const domains = card(page, "Top Domains");
  await domains.getByRole("button", { name: "Blocked", exact: true }).click();
  await expect(
    domains.getByText("telemetry.microsoft.com", { exact: true }),
  ).toBeVisible();
  await capture(domains, "fallback-blocked-domains");
});

test("dashboard loading skeletons", async ({ page }) => {
  const release = await holdRpc(page, "/api/trpc/");
  try {
    await page.goto("/");
    await expect(page.getByLabel("Loading blocking status")).toBeVisible();
    await expect(getQueryLogs(page).entries).toHaveAttribute(
      "aria-busy",
      "true",
    );
    await page.locator("svg").evaluateAll((elements) => {
      for (const element of elements) {
        if (element instanceof SVGSVGElement) {
          element.pauseAnimations();
          element.setCurrentTime(0);
        }
      }
    });
    await capturePage(page, "dashboard-loading");
  } finally {
    release();
  }
});

test("empty charts, lists and logs", async ({ page }) => {
  await overrideRpc(page, emptyLogs);
  await page.goto("/");
  await expect(page.getByText("No queries recorded yet.")).toBeVisible();
  await expect(page.getByText("No data available")).toHaveCount(2);
  await expect(
    getQueryLogs(page).entries.getByText("No results found."),
  ).toBeVisible();
  await capturePage(page, "dashboard-empty");
});

test("tablet layout", async ({ page, isMobile }) => {
  test.skip(isMobile, "One intermediate viewport is sufficient.");
  await page.setViewportSize({ width: 820, height: 1180 });
  await page.goto("/");
  await ready(page);
  await capturePage(page, "dashboard-tablet");
});

test("demo configuration controls", async ({ page }) => {
  await page.goto("/");
  await ready(page);
  const demo = page.getByRole("complementary", { name: "Demo configuration" });
  await capture(demo, "demo-minimized", { showDemoControls: true });
  await page.getByRole("button", { name: "Expand demo configuration" }).click();
  await expect(page).toHaveScreenshot("demo-expanded.png", {
    stylePath: [],
    animations: "disabled",
  });
  await page.getByRole("button", { name: "Demo services" }).click();
  await capture(popover(page), "demo-services");
  await page.getByRole("combobox", { name: "Servers", exact: true }).click();
  await capture(page.getByRole("listbox"), "demo-server-count");
});
