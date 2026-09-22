const topListCountPattern = /^1-5 of \d+$/;

import { expect, type Locator, type Page } from "@playwright/test";
import { jsonlStreamProducer } from "@trpc/server/unstable-core-do-not-import";
import SuperJSON from "superjson";
import { z } from "zod";
import type { DemoServerCount } from "~/demo/config";
import type { RouterOutputs } from "~/trpc/react";
import { getQueryLogs } from "./query-logs";

type Outputs = {
  [Group in keyof RouterOutputs]: {
    [Procedure in keyof RouterOutputs[Group] as `${Group}.${Procedure & string}`]: RouterOutputs[Group][Procedure];
  };
};
type Procedures = Outputs["servers"] & Outputs["logs"];
type Overrides = {
  [Path in keyof Procedures]?: { data: Procedures[Path] } | { error: string };
};

const responseSchema = z.array(
  z.object({
    result: z.object({ data: z.unknown() }).optional(),
    error: z.unknown().optional(),
  }),
);

export async function overrideRpc(page: Page, overrides: Overrides) {
  await page.route("**/api/trpc/**", async (route) => {
    const paths =
      new URL(route.request().url()).pathname
        .split("/api/trpc/")[1]
        ?.split(",") ?? [];
    if (!paths.some((path) => Object.hasOwn(overrides, path))) {
      await route.fallback();
      return;
    }
    let original: z.infer<typeof responseSchema> = [];
    if (paths.some((path) => !Object.hasOwn(overrides, path))) {
      const response = await route.fetch({
        headers: {
          ...route.request().headers(),
          "trpc-accept": "application/json",
        },
      });
      original = responseSchema.parse(await response.json());
    }
    const replacements = new Map<
      string,
      NonNullable<Overrides[keyof Overrides]>
    >(Object.entries(overrides));
    const stream = jsonlStreamProducer({
      // biome-ignore lint/suspicious/useAwait: tRPC JSONL encodes each procedure result as a promise.
      data: paths.map(async (path, index) => {
        const replacement = replacements.get(path);
        if (replacement && "error" in replacement) {
          return {
            error: {
              message: replacement.error,
              code: -32_603,
              data: { code: "INTERNAL_SERVER_ERROR", httpStatus: 500, path },
            },
          };
        }
        const item = original[index];
        if (replacement && "data" in replacement) {
          return { result: { data: replacement.data } };
        }
        if (item?.result) {
          return {
            result: { data: SuperJSON.parse(JSON.stringify(item.result.data)) },
          };
        }
        return { error: SuperJSON.parse(JSON.stringify(item?.error)) };
      }),
      serialize: SuperJSON.serialize,
    });
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: await new Response(stream).text(),
    });
  });
}

export async function holdRpc(page: Page, path: string) {
  const gate = Promise.withResolvers<void>();
  await page.route("**/api/trpc/**", async (route) => {
    if (new URL(route.request().url()).pathname.includes(path)) {
      await gate.promise;
    }
    await route.fallback();
  });
  return gate.resolve;
}

export function card(page: Page, title: string) {
  return page
    .locator('[data-slot="card"]')
    .filter({
      has: page
        .locator('[data-slot="card-title"]')
        .getByText(title, { exact: true }),
    })
    .last();
}

export async function ready(page: Page) {
  await expect(
    page.getByText("12 ms avg. response", { exact: true }),
  ).toBeVisible();
  await expect(getQueryLogs(page).entries).toHaveAttribute(
    "aria-busy",
    "false",
  );
  await expect(
    page.getByRole("button", { name: "Total", exact: true }),
  ).toBeVisible();
  await expect(page.getByText(topListCountPattern)).toHaveCount(2);
}

export async function configureDemo(
  page: Page,
  count: DemoServerCount = 3,
  logs = true,
) {
  await page.getByRole("button", { name: "Expand demo configuration" }).click();
  await page.getByRole("button", { name: "Demo services" }).click();
  await page.getByRole("combobox", { name: "Servers", exact: true }).click();
  await page
    .getByRole("option", { name: `${count} servers`, exact: true })
    .click();
  await expect(
    page.getByRole("combobox", { name: "Servers", exact: true }),
  ).toBeFocused();
  if (!logs) {
    await page.getByRole("switch", { name: "Query logs enabled" }).uncheck();
  }
  await closePopup(page.getByRole("button", { name: "Demo services" }));
  await page
    .getByRole("button", { name: "Minimize demo configuration" })
    .click();
  await expect(
    page.getByRole("button", { name: "Showing: All servers" }),
  ).toBeVisible();
}

export async function closePopup(trigger: Locator) {
  await trigger.page().keyboard.press("Escape");
  await expect(trigger).toHaveAttribute("aria-expanded", "false");
  await expect(trigger).toBeFocused();
}

export async function capture(
  target: Locator,
  name: string,
  options: {
    showDemoControls?: boolean;
  } = {},
) {
  await expect(target).toHaveScreenshot(`${name}.png`, {
    animations: "disabled",
    caret: "hide",
    ...(options.showDemoControls ? { stylePath: [] } : {}),
  });
}

export async function capturePage(
  page: Page,
  name: string,
  { fullPage = true }: { fullPage?: boolean } = {},
) {
  if (fullPage) {
    await page.evaluate(() =>
      window.scrollTo({ top: 0, left: 0, behavior: "instant" }),
    );
  }
  await page.mouse.move(0, 0);
  await expect(page).toHaveScreenshot(`${name}.png`, {
    fullPage,
    animations: "disabled",
    timeout: 15_000,
  });
}

export const popover = (page: Page) =>
  page.locator('[data-slot="popover-content"][data-state="open"]');

export const tooltip = (page: Page) =>
  page.locator('[data-slot="tooltip-content"][data-state$="open"]');
