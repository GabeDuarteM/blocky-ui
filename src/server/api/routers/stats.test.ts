import { beforeEach, describe, expect, it, vi } from "vitest";
import { type LogProvider, type StatsResult } from "~/server/logs/types";

const mocks = vi.hoisted(() => ({
  fetchBlockyStatistics: vi.fn(),
  getStats24h: vi.fn(),
}));

vi.mock("~/env", () => ({
  env: {
    BLOCKY_API_URL: "http://localhost:4000",
    BLOCKY_REQUEST_HEADERS: undefined,
    DEMO_MODE: false,
  },
}));

vi.mock("~/server/blocky/statistics", async (importOriginal) => ({
  ...(await importOriginal<typeof import("~/server/blocky/statistics")>()),
  fetchBlockyStatistics: mocks.fetchBlockyStatistics,
}));

import { statsRouter } from "~/server/api/routers/stats";
import { type createTRPCContext } from "~/server/api/trpc";
import { type BlockyStatistics } from "~/server/blocky/statistics";

type TRPCContext = Awaited<ReturnType<typeof createTRPCContext>>;

/** Blocky reports traffic of its own, so a fallback is always distinguishable. */
const BLOCKY_STATISTICS: BlockyStatistics = {
  summary: {
    queries: 200,
    blocked: 50,
    dropped: 0,
    errors: 0,
    avgResponseMs: 10,
    cacheHitRate: 0.75,
  },
  cache: { entries: 42 },
  lists: { denylist: { ads: 1000 }, allowlist: { custom: 5 } },
  topDomains: [],
  topBlockedDomains: [],
  topClients: [],
};

const LOG_STATS: StatsResult = {
  totalQueries: 5000,
  blocked: 500,
  cached: 3000,
  forwarded: 1500,
  durationSum: 40000,
};

const EMPTY_LOG_STATS: StatsResult = {
  totalQueries: 0,
  blocked: 0,
  cached: 0,
  forwarded: 0,
  durationSum: 0,
};

function createCaller(withLogProvider: boolean) {
  // Only getStats24h is exercised here; the rest of the provider is never
  // reached, so a partial fake keeps the fixture honest about what it stubs.
  const logProvider: Pick<LogProvider, "getStats24h"> = {
    getStats24h: mocks.getStats24h,
  };

  const ctx: TRPCContext = {
    headers: new Headers(),
    isDemoServiceAvailable: () => true,
    logProvider: withLogProvider ? (logProvider as LogProvider) : undefined,
  };

  return statsRouter.createCaller(ctx);
}

describe("stats.snapshot", () => {
  beforeEach(() => {
    // resetAllMocks, not clearAllMocks: the former also drops mockResolvedValue
    // implementations, so one test's stub cannot leak into the next.
    vi.resetAllMocks();
    mocks.fetchBlockyStatistics.mockResolvedValue(BLOCKY_STATISTICS);
  });

  it("uses blocky's own statistics when no query log is configured", async () => {
    const snapshot = await createCaller(false).snapshot();

    expect(snapshot?.overview.totalQueries).toBe(200);
    expect(mocks.getStats24h).not.toHaveBeenCalled();
  });

  it("prefers the query log for traffic counters, keeping blocky's state fields", async () => {
    mocks.getStats24h.mockResolvedValue(LOG_STATS);

    const snapshot = await createCaller(true).snapshot();

    // Traffic comes from the query log, which spans every blocky instance.
    expect(snapshot?.overview.totalQueries).toBe(5000);
    expect(snapshot?.overview.blocked).toBe(500);
    expect(snapshot?.overview.avgResponseMs).toBe(8); // 40000 / 5000
    expect(snapshot?.overview.cacheHitRate).toBeCloseTo(66.67, 1); // 3000 / 4500

    // Current blocky state is not in the query log, so it stays as reported.
    expect(snapshot?.overview.cacheEntries).toBe(42);
    expect(snapshot?.overview.listedDomains).toBe(1000);
  });

  it("falls back to blocky's statistics when the query log throws", async () => {
    mocks.getStats24h.mockRejectedValue(new Error("query log unreachable"));
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {
      // Intentionally silenced: the router logs the failure it recovers from.
    });

    const snapshot = await createCaller(true).snapshot();

    expect(snapshot?.overview.totalQueries).toBe(200);
    expect(consoleError).toHaveBeenCalled();
    consoleError.mockRestore();
  });

  it("falls back to blocky's statistics when the query log reports nothing", async () => {
    // Providers that catch internally report zeroes rather than throwing, which
    // would otherwise blank the cards while blocky is still serving traffic.
    mocks.getStats24h.mockResolvedValue(EMPTY_LOG_STATS);

    const snapshot = await createCaller(true).snapshot();

    expect(snapshot?.overview.totalQueries).toBe(200);
    expect(snapshot?.overview.blocked).toBe(50);
  });

  it("still reports zero when blocky itself has served no queries", async () => {
    mocks.fetchBlockyStatistics.mockResolvedValue({
      ...BLOCKY_STATISTICS,
      summary: { ...BLOCKY_STATISTICS.summary, queries: 0, blocked: 0 },
    });
    mocks.getStats24h.mockResolvedValue(EMPTY_LOG_STATS);

    const snapshot = await createCaller(true).snapshot();

    expect(snapshot?.overview.totalQueries).toBe(0);
  });
});
