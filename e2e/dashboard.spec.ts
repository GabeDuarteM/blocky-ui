import { expect, test, type Page } from "@playwright/test";

async function queryLogs(page: Page) {
  const logs = page.getByRole("region", { name: "Query Logs", exact: true });
  await logs.getByRole("switch", { name: "Auto", exact: true }).uncheck();
  await expect(logs.getByRole("table")).toHaveAttribute("aria-busy", "false");
  return logs;
}

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "> BlockyUI" })).toBeVisible();
});

test("blocking changes survive a page reload", async ({ page }) => {
  const status = page.getByRole("region", { name: "Blocking Status" });
  await expect(status.getByText("Enabled", { exact: true })).toBeVisible();
  await status.getByRole("button", { name: "5 minutes", exact: true }).click();
  await expect(status.getByText("Disabled", { exact: true })).toBeVisible();
  await expect(status.getByText(/Auto-enables in/)).toBeVisible();

  await page.reload();
  await expect(status.getByText("Disabled", { exact: true })).toBeVisible();
  await status.getByRole("button", { name: "Enable", exact: true }).click();
  await expect(status.getByText("Enabled", { exact: true })).toBeVisible();
  await expect(status.getByText(/Auto-enables in/)).toHaveCount(0);
});

test("DNS queries run only on selected servers", async ({ page }) => {
  await page.getByRole("button", { name: "Expand demo configuration" }).click();
  await page.getByRole("button", { name: "Demo services" }).click();
  await page.getByRole("combobox", { name: "Servers", exact: true }).click();
  await page.getByRole("option", { name: "3 servers", exact: true }).click();
  await page.keyboard.press("Escape");
  await page
    .getByRole("button", { name: "Minimize demo configuration" })
    .click();

  await page.getByRole("button", { name: "Choose Query targets" }).click();
  await page.getByRole("switch", { name: "Query targets: Office" }).uncheck();
  await page.keyboard.press("Escape");
  await page
    .getByRole("textbox", { name: "Domain to query" })
    .fill("example.com");
  await page.getByRole("button", { name: "Query", exact: true }).click();

  const results = page.getByRole("region", { name: "DNS query results" });
  for (const name of ["Home", "Backup"]) {
    const result = results.getByRole("region", {
      name: `Query result for ${name}`,
    });
    await expect(result.getByText("RESOLVED", { exact: true })).toBeVisible();
    await expect(
      result.getByText("93.184.216.34", { exact: true }),
    ).toBeVisible();
  }
  await expect(
    results.getByRole("region", { name: "Query result for Office" }),
  ).toHaveCount(0);
});

test("query log pagination changes rows and page size", async ({ page }) => {
  const logs = await queryLogs(page);
  const rows = logs
    .getByRole("rowgroup", { name: "Query log entries" })
    .getByRole("row");
  const firstPage = await rows.allTextContents();
  const firstRow = await rows.first().innerText();
  await expect(rows).toHaveCount(10);
  await expect(
    logs.getByRole("button", { name: "Previous page" }),
  ).toBeDisabled();

  await logs.getByRole("button", { name: "Next page" }).click();
  await expect(logs.getByRole("table")).toHaveAttribute("aria-busy", "false");
  await expect(rows).not.toHaveText(firstPage);
  await logs.getByRole("button", { name: "Previous page" }).click();
  await expect(rows).toHaveText(firstPage);

  await logs.getByRole("combobox", { name: "Rows per page" }).click();
  await page.getByRole("option", { name: "20", exact: true }).click();
  await expect(rows).toHaveCount(20);
  await expect(rows.first()).toHaveText(firstRow, { useInnerText: true });
});

test("domain suggestions filter the query log and can be cleared", async ({
  page,
}) => {
  const logs = await queryLogs(page);
  const domains = logs.getByRole("cell", { name: /^Domain / });
  const originalDomains = await domains.allTextContents();
  const domain = await domains.first().innerText();
  await logs
    .getByRole("textbox", { name: "Filter by domain or client" })
    .fill(domain);
  await page
    .getByRole("option")
    .filter({ has: page.getByText(domain, { exact: true }) })
    .click();
  await expect
    .poll(async () => {
      const values = await domains.allTextContents();
      return (
        values.length > 0 && values.every((value) => value.includes(domain))
      );
    })
    .toBe(true);

  await logs.getByRole("button", { name: "Clear filter" }).click();
  await page.keyboard.press("Escape");
  await expect(
    logs.getByRole("textbox", { name: "Filter by domain or client" }),
  ).toHaveValue("");
  await expect(domains).toHaveText(originalDomains);
});
