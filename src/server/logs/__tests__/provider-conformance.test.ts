import { beforeAll, afterAll, describe, it, expect } from "vitest";
import { type LogEntry, type LogProvider } from "~/server/logs/types";
import { getTimeRangeConfig } from "~/server/logs/aggregation-utils";
import { setupProviders } from "./setup";
import { countEntriesInRange } from "./seed-data";

let providers: Map<string, LogProvider>;
let cleanup: () => Promise<void> = async () => {};
let seedData: LogEntry[];

beforeAll(async () => {
  const result = await setupProviders();
  providers = result.providers;
  cleanup = result.cleanup;
  seedData = result.seedData;
});

afterAll(async () => {
  await cleanup();
});

function normalizeTimestamp(ts: string | null | undefined): string {
  if (!ts) {
    return "";
  }
  return ts.replace("T", " ").replace("Z", "");
}

function entriesInRange(range: "1h" | "24h" | "7d" | "30d"): LogEntry[] {
  const { startTime } = getTimeRangeConfig(range);
  return seedData.filter(
    (e) =>
      e.requestTs && new Date(e.requestTs).getTime() >= startTime.getTime(),
  );
}

function defineProviderTests(providerName: string) {
  describe(providerName, () => {
    let provider: LogProvider;

    beforeAll(() => {
      const p = providers.get(providerName);
      if (!p) {
        throw new Error(`Provider ${providerName} not found`);
      }
      provider = p;
    });

    describe("getQueryLogs", () => {
      it("returns all entries with correct totalCount", async () => {
        const result = await provider.getQueryLogs({ limit: 100, offset: 0 });
        expect(result.totalCount).toBe(seedData.length);
        expect(result.items).toHaveLength(seedData.length);
      });

      it("pagination works", async () => {
        const page1 = await provider.getQueryLogs({ limit: 2, offset: 0 });
        expect(page1.items).toHaveLength(2);
        expect(page1.totalCount).toBe(seedData.length);

        const page2 = await provider.getQueryLogs({ limit: 2, offset: 2 });
        expect(page2.items).toHaveLength(2);

        const page1Timestamps = page1.items.map((i) => i.requestTs);
        const page2Timestamps = page2.items.map((i) => i.requestTs);
        expect(page1Timestamps).not.toEqual(page2Timestamps);
      });

      it("filters by responseType", async () => {
        const result = await provider.getQueryLogs({
          limit: 100,
          offset: 0,
          responseType: "BLOCKED",
        });
        const expectedCount = seedData.filter(
          (e) => e.responseType === "BLOCKED",
        ).length;
        expect(result.totalCount).toBe(expectedCount);
        for (const item of result.items) {
          expect(item.responseType).toBe("BLOCKED");
        }
      });

      it("filters by client (case-insensitive partial)", async () => {
        const result = await provider.getQueryLogs({
          limit: 100,
          offset: 0,
          client: "phone",
        });
        const expectedCount = seedData.filter(
          (e) =>
            e.clientName !== null &&
            e.clientName.toLowerCase().includes("phone"),
        ).length;
        expect(result.totalCount).toBe(expectedCount);
        for (const item of result.items) {
          expect(item.clientName?.toLowerCase()).toContain("phone");
        }
      });

      it("filters by questionType", async () => {
        const result = await provider.getQueryLogs({
          limit: 100,
          offset: 0,
          questionType: "AAAA",
        });
        const expectedCount = seedData.filter(
          (e) => e.questionType === "AAAA",
        ).length;
        expect(result.totalCount).toBe(expectedCount);
        for (const item of result.items) {
          expect(item.questionType).toBe("AAAA");
        }
      });

      it("filters by search (case-insensitive partial domain)", async () => {
        const result = await provider.getQueryLogs({
          limit: 100,
          offset: 0,
          search: "github",
        });
        const expectedCount = seedData.filter(
          (e) =>
            e.questionName !== null &&
            e.questionName.toLowerCase().includes("github"),
        ).length;
        expect(result.totalCount).toBe(expectedCount);
        for (const item of result.items) {
          expect(item.questionName?.toLowerCase()).toContain("github");
        }
      });

      it("combined filters", async () => {
        const result = await provider.getQueryLogs({
          limit: 100,
          offset: 0,
          responseType: "BLOCKED",
          client: "Phone",
        });
        const expectedCount = seedData.filter(
          (e) =>
            e.responseType === "BLOCKED" &&
            e.clientName !== null &&
            e.clientName.toLowerCase().includes("phone"),
        ).length;
        expect(result.totalCount).toBe(expectedCount);
        for (const item of result.items) {
          expect(item.responseType).toBe("BLOCKED");
          expect(item.clientName?.toLowerCase()).toContain("phone");
        }
      });

      it("results ordered by requestTs descending", async () => {
        const result = await provider.getQueryLogs({ limit: 100, offset: 0 });
        for (let i = 0; i < result.items.length - 1; i++) {
          const current = result.items[i]?.requestTs ?? "";
          const next = result.items[i + 1]?.requestTs ?? "";
          expect(current >= next).toBe(true);
        }
      });

      it("nonexistent questionType returns empty results", async () => {
        const result = await provider.getQueryLogs({
          limit: 100,
          offset: 0,
          questionType: "MX",
        });
        expect(result.totalCount).toBe(0);
        expect(result.items).toHaveLength(0);
      });

      it("search does not match entries with null questionName", async () => {
        const result = await provider.getQueryLogs({
          limit: 100,
          offset: 0,
          search: "unknown",
        });
        for (const item of result.items) {
          expect(item.questionName).not.toBeNull();
        }
      });

      it("client filter does not match entries with null clientName", async () => {
        const result = await provider.getQueryLogs({
          limit: 100,
          offset: 0,
          client: "unknown",
        });
        for (const item of result.items) {
          expect(item.clientName).not.toBeNull();
        }
      });
    });

    describe("getStats24h", () => {
      it("returns correct totalQueries and blocked", async () => {
        const expected = countEntriesInRange(seedData, "24h");
        const result = await provider.getStats24h();
        expect(result.totalQueries).toBe(expected.total);
        expect(result.blocked).toBe(expected.blocked);
      });
    });

    describe("getQueriesOverTime", () => {
      it("returns buckets for 24h range", async () => {
        const result = await provider.getQueriesOverTime({ range: "24h" });
        expect(result.length).toBeGreaterThan(0);
        for (const entry of result) {
          expect(entry).toHaveProperty("time");
          expect(entry).toHaveProperty("total");
          expect(entry).toHaveProperty("blocked");
          expect(entry).toHaveProperty("cached");
        }
      });

      it("sum of totals matches entries in range", async () => {
        const result = await provider.getQueriesOverTime({ range: "24h" });
        const totalSum = result.reduce((sum, entry) => sum + entry.total, 0);
        const expected = countEntriesInRange(seedData, "24h");
        expect(totalSum).toBe(expected.total);
      });

      it("sum of blocked matches", async () => {
        const result = await provider.getQueriesOverTime({ range: "24h" });
        const blockedSum = result.reduce(
          (sum, entry) => sum + entry.blocked,
          0,
        );
        const expected = countEntriesInRange(seedData, "24h");
        expect(blockedSum).toBe(expected.blocked);
      });

      it("sum of cached matches", async () => {
        const result = await provider.getQueriesOverTime({ range: "24h" });
        const cachedSum = result.reduce((sum, entry) => sum + entry.cached, 0);
        const expected = countEntriesInRange(seedData, "24h");
        expect(cachedSum).toBe(expected.cached);
      });

      it("filtering by domain", async () => {
        const result = await provider.getQueriesOverTime({
          range: "24h",
          domain: "google",
        });
        const totalSum = result.reduce((sum, entry) => sum + entry.total, 0);
        const expected = entriesInRange("24h").filter(
          (e) =>
            e.questionName !== null &&
            e.questionName.toLowerCase().includes("google"),
        ).length;
        expect(totalSum).toBe(expected);
      });

      it("filtering by client", async () => {
        const result = await provider.getQueriesOverTime({
          range: "24h",
          client: "laptop",
        });
        const totalSum = result.reduce((sum, entry) => sum + entry.total, 0);
        const expected = entriesInRange("24h").filter(
          (e) =>
            e.clientName !== null &&
            e.clientName.toLowerCase().includes("laptop"),
        ).length;
        expect(totalSum).toBe(expected);
      });

      for (const range of ["1h", "7d", "30d"] as const) {
        it(`sum of totals matches entries in ${range} range`, async () => {
          const result = await provider.getQueriesOverTime({ range });
          const totalSum = result.reduce((sum, entry) => sum + entry.total, 0);
          const expected = countEntriesInRange(seedData, range);
          expect(totalSum).toBe(expected.total);
        });

        it(`sum of blocked matches in ${range} range`, async () => {
          const result = await provider.getQueriesOverTime({ range });
          const blockedSum = result.reduce(
            (sum, entry) => sum + entry.blocked,
            0,
          );
          const expected = countEntriesInRange(seedData, range);
          expect(blockedSum).toBe(expected.blocked);
        });

        it(`sum of cached matches in ${range} range`, async () => {
          const result = await provider.getQueriesOverTime({ range });
          const cachedSum = result.reduce(
            (sum, entry) => sum + entry.cached,
            0,
          );
          const expected = countEntriesInRange(seedData, range);
          expect(cachedSum).toBe(expected.cached);
        });

        it(`filtering by domain works in ${range} range`, async () => {
          const result = await provider.getQueriesOverTime({
            range,
            domain: "google",
          });
          const totalSum = result.reduce((sum, entry) => sum + entry.total, 0);
          const expected = entriesInRange(range).filter(
            (e) =>
              e.questionName !== null &&
              e.questionName.toLowerCase().includes("google"),
          ).length;
          expect(totalSum).toBe(expected);
        });

        it(`filtering by client works in ${range} range`, async () => {
          const result = await provider.getQueriesOverTime({
            range,
            client: "laptop",
          });
          const totalSum = result.reduce((sum, entry) => sum + entry.total, 0);
          const expected = entriesInRange(range).filter(
            (e) =>
              e.clientName !== null &&
              e.clientName.toLowerCase().includes("laptop"),
          ).length;
          expect(totalSum).toBe(expected);
        });
      }
    });

    describe("getTopDomains", () => {
      it("ranked by count descending", async () => {
        const result = await provider.getTopDomains({
          range: "30d",
          limit: 100,
          offset: 0,
          filter: "all",
        });
        for (let i = 0; i < result.items.length - 1; i++) {
          const current = result.items[i]?.count ?? 0;
          const next = result.items[i + 1]?.count ?? 0;
          expect(current).toBeGreaterThanOrEqual(next);
        }
      });

      it("pagination", async () => {
        const page1 = await provider.getTopDomains({
          range: "30d",
          limit: 2,
          offset: 0,
          filter: "all",
        });
        const page2 = await provider.getTopDomains({
          range: "30d",
          limit: 2,
          offset: 2,
          filter: "all",
        });
        const page1Domains = page1.items.map((i) => i.domain);
        const page2Domains = page2.items.map((i) => i.domain);
        expect(page1Domains).not.toEqual(page2Domains);
      });

      it("totalCount matches unique domains in range", async () => {
        const inRange = entriesInRange("30d");
        const uniqueDomains = new Set(
          inRange.map((e) => e.questionName ?? "unknown"),
        );
        const result = await provider.getTopDomains({
          range: "30d",
          limit: 100,
          offset: 0,
          filter: "all",
        });
        expect(result.totalCount).toBe(uniqueDomains.size);
      });

      it("percentage is correct", async () => {
        const inRange = entriesInRange("30d");
        const totalEntries = inRange.length;
        const result = await provider.getTopDomains({
          range: "30d",
          limit: 100,
          offset: 0,
          filter: "all",
        });
        for (const item of result.items) {
          const expectedPercentage = (item.count / totalEntries) * 100;
          expect(item.percentage).toBeCloseTo(expectedPercentage, 1);
        }
      });

      it("blocked count for fully blocked domain", async () => {
        const result = await provider.getTopDomains({
          range: "30d",
          limit: 100,
          offset: 0,
          filter: "all",
        });
        const blockedSite = result.items.find(
          (i) => i.domain === "blocked-site.com",
        );
        expect(blockedSite).toBeDefined();
        expect(blockedSite?.blocked).toBe(blockedSite?.count);
      });

      it("filter: blocked only returns domains with blocked entries", async () => {
        const result = await provider.getTopDomains({
          range: "30d",
          limit: 100,
          offset: 0,
          filter: "blocked",
        });
        for (const item of result.items) {
          expect(item.blocked).toBeGreaterThan(0);
        }
        const inRange = entriesInRange("30d");
        const domainsWithBlocked = new Set(
          inRange
            .filter((e) => e.responseType === "BLOCKED")
            .map((e) => e.questionName ?? "unknown"),
        );
        expect(result.totalCount).toBe(domainsWithBlocked.size);
      });

      it("filter: blocked percentage is relative to blocked entries", async () => {
        const result = await provider.getTopDomains({
          range: "30d",
          limit: 100,
          offset: 0,
          filter: "blocked",
        });
        const inRange = entriesInRange("30d");
        const blockedEntries = inRange.filter(
          (e) => e.responseType === "BLOCKED",
        );
        for (const item of result.items) {
          const expectedPercentage = (item.count / blockedEntries.length) * 100;
          expect(item.percentage).toBeCloseTo(expectedPercentage, 1);
        }
      });

      it("null questionName mapped to unknown", async () => {
        const result = await provider.getTopDomains({
          range: "30d",
          limit: 100,
          offset: 0,
          filter: "all",
        });
        const unknownEntry = result.items.find((i) => i.domain === "unknown");
        const inRange = entriesInRange("30d");
        const nullDomainCount = inRange.filter(
          (e) => e.questionName === null,
        ).length;
        expect(unknownEntry).toBeDefined();
        expect(unknownEntry?.count).toBe(nullDomainCount);
      });
    });

    describe("getTopClients", () => {
      it("ranked by total descending", async () => {
        const result = await provider.getTopClients({
          range: "30d",
          limit: 100,
          offset: 0,
          filter: "all",
        });
        for (let i = 0; i < result.items.length - 1; i++) {
          const current = result.items[i]?.total ?? 0;
          const next = result.items[i + 1]?.total ?? 0;
          expect(current).toBeGreaterThanOrEqual(next);
        }
      });

      it("pagination", async () => {
        const page1 = await provider.getTopClients({
          range: "30d",
          limit: 2,
          offset: 0,
          filter: "all",
        });
        const page2 = await provider.getTopClients({
          range: "30d",
          limit: 2,
          offset: 2,
          filter: "all",
        });
        const page1Clients = page1.items.map((i) => i.client);
        const page2Clients = page2.items.map((i) => i.client);
        expect(page1Clients).not.toEqual(page2Clients);
      });

      it("totalCount matches unique clients in range", async () => {
        const inRange = entriesInRange("30d");
        const uniqueClients = new Set(
          inRange.map((e) => e.clientName ?? "unknown"),
        );
        const result = await provider.getTopClients({
          range: "30d",
          limit: 100,
          offset: 0,
          filter: "all",
        });
        expect(result.totalCount).toBe(uniqueClients.size);
      });

      it("percentage is correct", async () => {
        const inRange = entriesInRange("30d");
        const totalEntries = inRange.length;
        const result = await provider.getTopClients({
          range: "30d",
          limit: 100,
          offset: 0,
          filter: "all",
        });
        for (const item of result.items) {
          const expectedPercentage = (item.total / totalEntries) * 100;
          expect(item.percentage).toBeCloseTo(expectedPercentage, 1);
        }
      });

      it("blocked count for clients with blocked entries", async () => {
        const inRange = entriesInRange("30d");
        const result = await provider.getTopClients({
          range: "30d",
          limit: 100,
          offset: 0,
          filter: "all",
        });
        for (const item of result.items) {
          const expectedBlocked = inRange.filter(
            (e) =>
              (e.clientName ?? "unknown") === item.client &&
              e.responseType === "BLOCKED",
          ).length;
          expect(item.blocked).toBe(expectedBlocked);
        }
      });

      it("filter: blocked only returns clients with blocked entries", async () => {
        const result = await provider.getTopClients({
          range: "30d",
          limit: 100,
          offset: 0,
          filter: "blocked",
        });
        for (const item of result.items) {
          expect(item.blocked).toBeGreaterThan(0);
        }
        const inRange = entriesInRange("30d");
        const clientsWithBlocked = new Set(
          inRange
            .filter((e) => e.responseType === "BLOCKED")
            .map((e) => e.clientName ?? "unknown"),
        );
        expect(result.totalCount).toBe(clientsWithBlocked.size);
      });

      it("filter: blocked percentage is relative to blocked entries", async () => {
        const result = await provider.getTopClients({
          range: "30d",
          limit: 100,
          offset: 0,
          filter: "blocked",
        });
        const inRange = entriesInRange("30d");
        const blockedEntries = inRange.filter(
          (e) => e.responseType === "BLOCKED",
        );
        for (const item of result.items) {
          const expectedPercentage = (item.total / blockedEntries.length) * 100;
          expect(item.percentage).toBeCloseTo(expectedPercentage, 1);
        }
      });

      it("null clientName mapped to unknown", async () => {
        const result = await provider.getTopClients({
          range: "30d",
          limit: 100,
          offset: 0,
          filter: "all",
        });
        const unknownEntry = result.items.find((i) => i.client === "unknown");
        const inRange = entriesInRange("30d");
        const nullClientCount = inRange.filter(
          (e) => e.clientName === null,
        ).length;
        expect(unknownEntry).toBeDefined();
        expect(unknownEntry?.total).toBe(nullClientCount);
      });
    });

    describe("getQueryTypesBreakdown", () => {
      it("correct type distribution sorted by count descending", async () => {
        const result = await provider.getQueryTypesBreakdown("30d");
        const types = result.map((r) => r.type);
        expect(types).toContain("A");
        expect(types).toContain("AAAA");
        expect(types).toContain("CNAME");
        for (let i = 0; i < result.length - 1; i++) {
          expect(result[i]?.count ?? 0).toBeGreaterThanOrEqual(
            result[i + 1]?.count ?? 0,
          );
        }
      });

      it("correct counts per type", async () => {
        const inRange = entriesInRange("30d");
        const result = await provider.getQueryTypesBreakdown("30d");
        for (const entry of result) {
          const expectedCount = inRange.filter(
            (e) => e.questionType === entry.type,
          ).length;
          expect(entry.count).toBe(expectedCount);
        }
      });

      it("percentages sum to approximately 100", async () => {
        const result = await provider.getQueryTypesBreakdown("30d");
        const totalPercentage = result.reduce(
          (sum, entry) => sum + entry.percentage,
          0,
        );
        expect(totalPercentage).toBeCloseTo(100, 0);
      });
    });

    describe("searchDomains", () => {
      it("partial match with correct count", async () => {
        const result = await provider.searchDomains({
          range: "30d",
          query: "google",
          limit: 10,
        });
        const googleEntry = result.find((r) => r.domain === "google.com");
        expect(googleEntry).toBeDefined();
        const expectedCount = entriesInRange("30d").filter(
          (e) => e.questionName === "google.com",
        ).length;
        expect(googleEntry?.count).toBe(expectedCount);
      });

      it("case-insensitive", async () => {
        const result = await provider.searchDomains({
          range: "30d",
          query: "GITHUB",
          limit: 10,
        });
        const domains = result.map((r) => r.domain);
        expect(domains).toContain("GitHub.com");
      });

      it("respects limit", async () => {
        const result = await provider.searchDomains({
          range: "30d",
          query: "o",
          limit: 2,
        });
        expect(result.length).toBeLessThanOrEqual(2);
      });

      it("empty query returns empty array", async () => {
        const result = await provider.searchDomains({
          range: "30d",
          query: "",
          limit: 10,
        });
        expect(result).toHaveLength(0);
      });
    });

    describe("searchClients", () => {
      it("partial match with correct count", async () => {
        const result = await provider.searchClients({
          range: "30d",
          query: "lap",
          limit: 10,
        });
        const laptopEntry = result.find((r) => r.client === "laptop");
        expect(laptopEntry).toBeDefined();
        const expectedCount = entriesInRange("30d").filter(
          (e) => e.clientName === "laptop",
        ).length;
        expect(laptopEntry?.count).toBe(expectedCount);
      });

      it("case-insensitive", async () => {
        const result = await provider.searchClients({
          range: "30d",
          query: "PHONE",
          limit: 10,
        });
        const clients = result.map((r) => r.client);
        expect(clients).toContain("Phone");
      });

      it("respects limit", async () => {
        const result = await provider.searchClients({
          range: "30d",
          query: "e",
          limit: 1,
        });
        expect(result.length).toBeLessThanOrEqual(1);
      });

      it("empty query returns empty array", async () => {
        const result = await provider.searchClients({
          range: "30d",
          query: "",
          limit: 10,
        });
        expect(result).toHaveLength(0);
      });
    });
  });
}

defineProviderTests("mysql");
defineProviderTests("csv");
defineProviderTests("csv-client");

describe("cross-provider consistency", () => {
  const providerNames = ["mysql", "csv", "csv-client"] as const;

  async function queryAllProviders<T>(
    fn: (provider: LogProvider) => Promise<T>,
  ): Promise<T[]> {
    return Promise.all(
      providerNames.map(async (name) => {
        const provider = providers.get(name);
        if (!provider) {
          throw new Error(`Provider ${name} not found`);
        }
        return fn(provider);
      }),
    );
  }

  function compareAcrossProviders<T>(
    results: T[],
    compareFn: (baseline: T, current: T) => void,
  ) {
    const baseline = results[0];
    if (!baseline) {
      throw new Error("No baseline result");
    }
    for (let i = 1; i < results.length; i++) {
      const current = results[i];
      if (!current) {
        throw new Error(`No result for provider ${providerNames[i]}`);
      }
      compareFn(baseline, current);
    }
  }

  it("getQueryLogs returns identical items across all providers", async () => {
    const results = await queryAllProviders((p) =>
      p.getQueryLogs({ limit: 100, offset: 0 }),
    );

    compareAcrossProviders(results, (baseline, current) => {
      expect(current.totalCount).toBe(baseline.totalCount);
      for (let j = 0; j < baseline.items.length; j++) {
        const baseItem = baseline.items[j];
        const currItem = current.items[j];
        // Normalize timestamps: MySQL returns "YYYY-MM-DD HH:mm:ss.SSS"
        // while CSV providers return "YYYY-MM-DDTHH:mm:ss.SSSZ"
        expect(normalizeTimestamp(currItem?.requestTs)).toBe(
          normalizeTimestamp(baseItem?.requestTs),
        );
        expect(currItem?.clientName).toBe(baseItem?.clientName);
        expect(currItem?.questionName).toBe(baseItem?.questionName);
        expect(currItem?.responseType).toBe(baseItem?.responseType);
        expect(currItem?.questionType).toBe(baseItem?.questionType);
      }
    });
  });

  it("getTopDomains returns identical results across all providers", async () => {
    const results = await queryAllProviders((p) =>
      p.getTopDomains({ range: "30d", limit: 100, offset: 0, filter: "all" }),
    );

    compareAcrossProviders(results, (baseline, current) => {
      expect(current.totalCount).toBe(baseline.totalCount);
      expect(current.items.map((i) => i.domain)).toEqual(
        baseline.items.map((i) => i.domain),
      );
      for (let j = 0; j < baseline.items.length; j++) {
        expect(current.items[j]?.count).toBe(baseline.items[j]?.count);
        expect(current.items[j]?.blocked).toBe(baseline.items[j]?.blocked);
        expect(current.items[j]?.percentage).toBeCloseTo(
          baseline.items[j]?.percentage ?? 0,
          1,
        );
      }
    });
  });

  it("getTopClients returns identical results across all providers", async () => {
    const results = await queryAllProviders((p) =>
      p.getTopClients({ range: "30d", limit: 100, offset: 0, filter: "all" }),
    );

    compareAcrossProviders(results, (baseline, current) => {
      expect(current.totalCount).toBe(baseline.totalCount);
      expect(current.items.map((i) => i.client)).toEqual(
        baseline.items.map((i) => i.client),
      );
      for (let j = 0; j < baseline.items.length; j++) {
        expect(current.items[j]?.total).toBe(baseline.items[j]?.total);
        expect(current.items[j]?.blocked).toBe(baseline.items[j]?.blocked);
        expect(current.items[j]?.percentage).toBeCloseTo(
          baseline.items[j]?.percentage ?? 0,
          1,
        );
      }
    });
  });

  it("getQueryTypesBreakdown returns identical results across all providers", async () => {
    const results = await queryAllProviders((p) =>
      p.getQueryTypesBreakdown("30d"),
    );

    compareAcrossProviders(results, (baseline, current) => {
      expect(current.map((e) => e.type)).toEqual(baseline.map((e) => e.type));
      for (let j = 0; j < baseline.length; j++) {
        expect(current[j]?.count).toBe(baseline[j]?.count);
        expect(current[j]?.percentage).toBeCloseTo(
          baseline[j]?.percentage ?? 0,
          1,
        );
      }
    });
  });

  it("getStats24h returns identical results across all providers", async () => {
    const results = await queryAllProviders((p) => p.getStats24h());

    compareAcrossProviders(results, (baseline, current) => {
      expect(current.totalQueries).toBe(baseline.totalQueries);
      expect(current.blocked).toBe(baseline.blocked);
    });
  });

  it("getQueriesOverTime totals match across all providers", async () => {
    for (const range of ["1h", "24h", "7d", "30d"] as const) {
      const results = await queryAllProviders((p) =>
        p.getQueriesOverTime({ range }),
      );

      compareAcrossProviders(results, (baseline, current) => {
        const baselineTotals = {
          total: baseline.reduce((s, e) => s + e.total, 0),
          blocked: baseline.reduce((s, e) => s + e.blocked, 0),
          cached: baseline.reduce((s, e) => s + e.cached, 0),
        };
        const currentTotals = {
          total: current.reduce((s, e) => s + e.total, 0),
          blocked: current.reduce((s, e) => s + e.blocked, 0),
          cached: current.reduce((s, e) => s + e.cached, 0),
        };
        expect(currentTotals.total).toBe(baselineTotals.total);
        expect(currentTotals.blocked).toBe(baselineTotals.blocked);
        expect(currentTotals.cached).toBe(baselineTotals.cached);
      });
    }
  });

  it("searchDomains returns identical results across all providers", async () => {
    for (const query of ["google", "blocked", "GITHUB"]) {
      const results = await queryAllProviders((p) =>
        p.searchDomains({ range: "30d", query, limit: 100 }),
      );

      compareAcrossProviders(results, (baseline, current) => {
        expect(current.map((e) => e.domain)).toEqual(
          baseline.map((e) => e.domain),
        );
        for (let j = 0; j < baseline.length; j++) {
          expect(current[j]?.count).toBe(baseline[j]?.count);
        }
      });
    }
  });

  it("searchClients returns identical results across all providers", async () => {
    for (const query of ["lap", "Phone", "server"]) {
      const results = await queryAllProviders((p) =>
        p.searchClients({ range: "30d", query, limit: 100 }),
      );

      compareAcrossProviders(results, (baseline, current) => {
        expect(current.map((e) => e.client)).toEqual(
          baseline.map((e) => e.client),
        );
        for (let j = 0; j < baseline.length; j++) {
          expect(current[j]?.count).toBe(baseline[j]?.count);
        }
      });
    }
  });
});
