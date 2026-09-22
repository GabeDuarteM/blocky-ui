import { appendFile, mkdtemp, rename, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  entryToCsvLine,
  formatDate,
  makeEntry,
} from "~/server/logs/__tests__/setup";
import {
  aggregateQueriesOverTime,
  aggregateQueryTypes,
  aggregateTopClients,
  aggregateTopDomains,
} from "~/server/logs/aggregation-utils";
import { CsvClientLogProvider } from "~/server/logs/csv/client-provider";
import { CsvLogProvider } from "~/server/logs/csv/provider";
// biome-ignore lint/performance/noNamespaceImport: Spy on the module export used by the CSV reader.
import * as csvUtils from "~/server/logs/csv/utils";
import type { LogEntry } from "~/server/logs/types";

let directory: string;
let now: number;
beforeEach(async () => {
  directory = await mkdtemp(join(tmpdir(), "csv-history-"));
  now = new Date(2026, 8, 19, 0, 2).getTime();
  vi.spyOn(Date, "now").mockImplementation(() => now);
});
afterEach(async () => {
  vi.restoreAllMocks();
  await rm(directory, { recursive: true, force: true });
});

function entry(age: number, overrides: Partial<LogEntry> = {}) {
  return makeEntry({
    requestTs: new Date(now - age).toISOString(),
    ...overrides,
  });
}
async function save(entries: LogEntry[], client = "ALL") {
  const grouped = new Map<string, LogEntry[]>();
  for (const row of entries) {
    const file = join(
      directory,
      `${formatDate(new Date(row.requestTs ?? now))}_${client}.log`,
    );
    const rows = grouped.get(file) ?? [];
    rows.push(row);
    grouped.set(file, rows);
  }
  await Promise.all(
    [...grouped].map(([file, rows]) =>
      writeFile(file, `${rows.map(entryToCsvLine).join("\n")}\n`),
    ),
  );
}
const DAY = 86_400_000;

describe.each([CsvLogProvider, CsvClientLogProvider])(
  "%s history",
  (Provider) => {
    it("keeps charts, rankings and query logs across midnight and all retained dates", async () => {
      const rows = [
        entry(60_000),
        entry(5 * 60_000, { responseType: "BLOCKED", questionType: "AAAA" }),
        entry(6 * DAY, { clientName: "phone" }),
        entry(29 * DAY),
        entry(40 * DAY),
      ];
      await save(rows);
      const provider = new Provider({ directory });
      for (const range of ["1h", "24h", "7d", "30d"] as const) {
        // biome-ignore lint/performance/noAwaitInLoops: Exercise successive requests against the same provider cache.
        expect(await provider.getQueriesOverTime({ range })).toEqual(
          aggregateQueriesOverTime(rows, range),
        );
      }
      const inRange = rows.slice(0, 4);
      const options = { range: "30d", offset: 0, filter: "all" } as const;
      expect(await provider.getTopDomains(options)).toEqual(
        aggregateTopDomains(inRange, 100, 0),
      );
      expect(await provider.getTopClients(options)).toEqual(
        aggregateTopClients(inRange, 100, 0),
      );
      expect(await provider.getQueryTypesBreakdown("30d")).toEqual(
        aggregateQueryTypes(inRange),
      );
      expect(await provider.getQueryLogs({ offset: 0, limit: 100 })).toEqual({
        items: rows,
        totalCount: 5,
      });
    });

    it("returns the first page without scanning older days", async () => {
      const rows = [entry(0), entry(DAY), entry(2 * DAY)];
      await save(rows);
      const scan = vi.spyOn(csvUtils, "scanEntries");
      const provider = new Provider({ directory });
      expect(await provider.getQueryLogRows({ limit: 1, offset: 0 })).toEqual(
        rows.slice(0, 1),
      );
      expect(scan).toHaveBeenCalledTimes(1);
      expect(scan.mock.calls[0]?.[0]).toBe(
        join(directory, `${formatDate(new Date(now))}_ALL.log`),
      );
    });

    it("shares each completed file scan across concurrent dashboard requests", async () => {
      const rows = [
        entry(DAY, {
          responseType: "BLOCKED",
          questionType: "AAAA",
          questionName: "münchen-🌍.example",
        }),
        entry(2 * DAY, { clientName: "téléphone", responseType: "CACHED" }),
      ];
      await save(rows);
      const scan = vi.spyOn(csvUtils, "scanEntries");
      const provider = new Provider({ directory });
      const options = { range: "30d", offset: 0, filter: "all" } as const;
      const [chart, domains, clients, count] = await Promise.all([
        provider.getQueriesOverTime(options),
        provider.getTopDomains(options),
        provider.getTopClients(options),
        provider.getQueryLogCount({}),
      ]);
      expect(chart).toEqual(aggregateQueriesOverTime(rows, "30d"));
      expect(domains).toEqual(aggregateTopDomains(rows, 100, 0));
      expect(clients).toEqual(aggregateTopClients(rows, 100, 0));
      expect(count).toBe(rows.length);
      expect(scan).toHaveBeenCalledTimes(2);
      expect(await provider.getQueriesOverTime({ range: "7d" })).toEqual(
        aggregateQueriesOverTime(rows, "7d"),
      );
      expect(await provider.getQueryTypesBreakdown("30d")).toEqual(
        aggregateQueryTypes(rows),
      );
      expect(scan).toHaveBeenCalledTimes(2);
    });

    it("discovers the new day and late additions to yesterday without a restart", async () => {
      now = new Date(2026, 8, 18, 23, 59).getTime();
      const first = entry(0);
      await save([first]);
      const provider = new Provider({ directory });
      expect(await provider.getQueryLogCount({})).toBe(1);
      await provider.getQueriesOverTime({ range: "7d" });
      now += 3 * 60_000;
      const second = entry(0);
      const late = entry(4 * 60_000, { responseType: "BLOCKED" });
      await save([second]);
      await appendFile(
        join(
          directory,
          `${formatDate(new Date(late.requestTs ?? ""))}_ALL.log`,
        ),
        `${entryToCsvLine(late)}\n`,
      );
      expect(await provider.getQueryLogs({ offset: 0, limit: 10 })).toEqual({
        items: [second, first, late],
        totalCount: 3,
      });
      expect(await provider.getQueriesOverTime({ range: "7d" })).toEqual(
        aggregateQueriesOverTime([first, second, late], "7d"),
      );
    });

    it("reuses complete days as the window moves, while rechecking the boundary days", async () => {
      const rows = [entry(0), entry(DAY), entry(2 * DAY), entry(30 * DAY)];
      await save(rows);
      const read = vi.spyOn(csvUtils, "scanEntries");
      const provider = new Provider({ directory });
      await Promise.all([
        provider.getQueriesOverTime({ range: "30d" }),
        provider.getQueriesOverTime({ range: "30d" }),
      ]);
      expect(read).toHaveBeenCalledTimes(4);
      read.mockClear();
      now += 60_000;
      expect(await provider.getQueriesOverTime({ range: "30d" })).toEqual(
        aggregateQueriesOverTime(rows, "30d"),
      );
      expect(read.mock.calls.map(([file]) => file)).toEqual([
        join(directory, `${formatDate(new Date(now - 30 * DAY))}_ALL.log`),
        join(directory, `${formatDate(new Date(now))}_ALL.log`),
      ]);
    });

    it("does not reuse summaries between filters or hostname scopes", async () => {
      const rows = [
        entry(DAY, {
          hostname: "one",
          questionName: "ads.example",
          responseType: "BLOCKED",
          clientName: "phone",
        }),
        entry(2 * DAY, { hostname: "two", questionName: "news.example" }),
      ];
      await save(rows);
      const provider = new Provider({ directory });
      expect(
        await provider.getQueriesOverTime({
          range: "7d",
          excludedHostnames: ["two"],
          domain: "ADS",
          client: "PH",
        }),
      ).toEqual(aggregateQueriesOverTime(rows.slice(0, 1), "7d"));
      expect(
        await provider.getQueryLogCount({ excludedHostnames: ["one"] }),
      ).toBe(1);
      expect(
        await provider.getQueryLogRows({
          search: "ADS",
          client: "PH",
          responseType: "BLOCKED",
          questionType: "A",
          offset: 0,
          limit: 10,
        }),
      ).toEqual(rows.slice(0, 1));
      expect(
        await provider.getTopDomains({
          range: "7d",
          filter: "blocked",
          offset: 0,
        }),
      ).toEqual(aggregateTopDomains(rows.slice(0, 1), 10, 0));
      expect(await provider.getQueriesOverTime({ range: "7d" })).toEqual(
        aggregateQueriesOverTime(rows, "7d"),
      );
    });

    it("keeps exact domain and contains searches separate in cached rows and counts", async () => {
      const rows = [
        entry(DAY, { questionName: "ads.example" }),
        entry(DAY, { questionName: "cdn.ads.example" }),
        entry(DAY, { questionName: "news.example" }),
      ];
      await save(rows);
      const provider = new Provider({ directory });
      const cases = [
        { filters: {}, expected: rows },
        { filters: { domain: "ADS.EXAMPLE" }, expected: rows.slice(0, 1) },
        { filters: { search: "ads.example" }, expected: rows.slice(0, 2) },
        { filters: { domain: "cdn.ads.example" }, expected: rows.slice(1, 2) },
        {
          filters: { search: "example", domain: "ADS.EXAMPLE" },
          expected: rows.slice(0, 1),
        },
      ];
      for (const { filters, expected } of cases) {
        // biome-ignore lint/performance/noAwaitInLoops: Exercise successive requests against the same provider cache.
        expect(await provider.getQueryLogCount(filters)).toBe(expected.length);
        expect(
          await provider.getQueryLogRows({ ...filters, offset: 0, limit: 10 }),
        ).toEqual(expected);
      }
    });

    it("reflects replacement, truncation and retention deletion of cached files", async () => {
      const rows = [entry(DAY), entry(2 * DAY)];
      await save(rows);
      const provider = new Provider({ directory });
      expect(await provider.getQueryLogCount({})).toBe(2);
      const file = join(
        directory,
        `${formatDate(new Date(now - DAY))}_ALL.log`,
      );
      const replacement = entry(DAY, { questionName: "other-domain.com" });
      await writeFile(
        join(directory, "replacement"),
        `${entryToCsvLine(replacement)}\n`,
      );
      await rename(join(directory, "replacement"), file);
      expect(
        (await provider.getQueryLogRows({ limit: 1, offset: 0 }))[0],
      ).toEqual(replacement);
      await writeFile(file, "");
      expect(await provider.getQueryLogCount({})).toBe(1);
      await rm(
        join(directory, `${formatDate(new Date(now - 2 * DAY))}_ALL.log`),
      );
      expect(await provider.getQueryLogs({ limit: 10, offset: 0 })).toEqual({
        items: [],
        totalCount: 0,
      });
    });

    it("pages out-of-order records across days and clients without losing timestamp ties", async () => {
      const rows = Array.from({ length: 1200 }, (_, i) =>
        entry((i % 3) * DAY + (i % 17) * 1000, {
          questionName: `domain-${i}.example`,
        }),
      );
      await save(
        rows.filter((_, i) => i % 2 === 0),
        "laptop",
      );
      await save(
        rows.filter((_, i) => i % 2 !== 0),
        "phone",
      );
      const provider = new Provider({ directory });
      const first = await provider.getQueryLogs({ offset: 0, limit: 1200 });
      expect(first.totalCount).toBe(1200);
      expect(new Set(first.items.map((row) => row.questionName)).size).toBe(
        1200,
      );
      expect(first.items.map((row) => row.requestTs)).toEqual(
        rows
          .map((row) => row.requestTs)
          .sort()
          .reverse(),
      );
      for (const offset of [0, 255, 510, 1050, 1200]) {
        // biome-ignore lint/performance/noAwaitInLoops: Exercise successive requests against the same provider cache.
        expect(await provider.getQueryLogRows({ offset, limit: 100 })).toEqual(
          first.items.slice(offset, offset + 100),
        );
      }
    });

    it("ignores malformed and unfinished quoted records, then reads them when completed", async () => {
      const valid = entry(0);
      const file = join(directory, `${formatDate(new Date(now))}_ALL.log`);
      await writeFile(
        file,
        entryToCsvLine(valid) +
          "\ninvalid\trow\n" +
          `${valid.requestTs}\t10.0.0.1\ttest-client\t5\tRESOLVED\ttest-domain.com\t"unfinished`,
      );
      const provider = new Provider({ directory });
      expect(await provider.getQueryLogCount({})).toBe(1);
      await appendFile(file, '\nanswer"\tNOERROR\tRESOLVED\tA\ttest\n');
      expect(await provider.getQueryLogCount({})).toBe(2);
    });

    it("excludes future events and expires events at the exact rolling boundary", async () => {
      const rows = [entry(60 * 60_000), entry(59 * 60_000), entry(-30_000)];
      await save(rows);
      const provider = new Provider({ directory });
      expect(await provider.getQueriesOverTime({ range: "1h" })).toEqual(
        aggregateQueriesOverTime(rows, "1h"),
      );
      now += 60_000;
      expect(await provider.getQueriesOverTime({ range: "1h" })).toEqual(
        aggregateQueriesOverTime(rows, "1h"),
      );
    });
  },
);
