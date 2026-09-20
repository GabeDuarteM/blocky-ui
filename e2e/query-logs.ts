import { type Page } from "@playwright/test";

export function getQueryLogs(page: Page) {
  const region = page.getByRole("region", { name: "Query Logs", exact: true });
  const entries = region
    .getByRole("rowgroup", { name: "Query log entries" })
    .or(region.getByRole("list", { name: "Query log entries" }));
  const rows = entries.getByRole("row").or(entries.getByRole("listitem"));
  return { region, entries, rows };
}
