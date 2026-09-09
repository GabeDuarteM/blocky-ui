import { afterEach, expect, it } from "vitest";
import { rm } from "node:fs/promises";
import { createLogCoordinator } from "~/server/logs/coordinator";
import { parseConfiguration } from "~/server/config/schema";
import { makeEntry, setupCsv, setupPostgres } from "./setup";

const cleanup: (() => Promise<unknown>)[] = [];

afterEach(async () => {
  for (const close of cleanup.splice(0).reverse()) {
    await close();
  }
});

it.each(["csv", "postgres"] as const)(
  "paginates every event once with out-of-order %s timestamps",
  async (type) => {
    const latest = makeEntry({
      requestTs: "2026-09-10T12:00:03.000Z",
      questionName: "latest.test",
    });
    const oldest = makeEntry({
      requestTs: type === "postgres" ? null : "2026-09-10T12:00:01.000Z",
      questionName: "oldest.test",
    });
    const first =
      type === "postgres"
        ? await setupPostgres([latest, oldest])
        : setupCsv([latest, oldest]);

    cleanup.push(async () => {
      if ("container" in first) {
        await first.provider.close();
        await first.container.stop();
      } else {
        await rm(first.directory, { recursive: true, force: true });
      }
    });

    const second = setupCsv([
      makeEntry({
        requestTs: "2026-09-10T12:00:02.000Z",
        questionName: "middle.test",
      }),
    ]);

    cleanup.push(() => rm(second.directory, { recursive: true, force: true }));

    const configuration = parseConfiguration({
      servers: {
        a: { url: "http://a", logs: { source: "a" } },
        b: { url: "http://b", logs: { source: "b" } },
      },
      logSources: {
        a: { type: "csv", target: "a" },
        b: { type: "csv", target: "b" },
      },
    });
    const coordinator = createLogCoordinator(configuration, async (source) =>
      source.target === "a" ? first.provider : second.provider,
    );
    const names: (string | null)[] = [];

    for (let offset = 0; offset < 3; offset++) {
      const page = await coordinator.rows(["a", "b"], { offset, limit: 1 });
      expect(page.diagnostics).toEqual([]);
      expect(page.items).toHaveLength(1);
      names.push(...page.items.map((item) => item.questionName));
    }

    expect(names).toEqual(["latest.test", "middle.test", "oldest.test"]);
  },
  60_000,
);
