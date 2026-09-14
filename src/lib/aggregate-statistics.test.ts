import { describe, expect, it } from "vitest";
import {
  aggregateStatistics,
  aggregateStatisticsTraffic,
} from "~/lib/aggregate-statistics";
import { type RouterOutputs } from "~/trpc/react";

type Result = RouterOutputs["servers"]["statistics"][number];

function result(
  serverId: string,
  {
    queries,
    cached,
    forwarded,
    answered,
    latency,
  }: {
    queries: number;
    cached: number;
    forwarded: number;
    answered: number;
    latency: number;
  },
) {
  return {
    serverId,
    success: true,
    data: {
      answered,
      summary: {
        queries,
        cached,
        forwarded,
        avgResponseMs: latency,
        blocked: 0,
        dropped: 0,
        errors: queries - answered,
        cacheHitRate: cached / (cached + forwarded),
      },
      overview: {
        totalQueries: queries,
        blocked: 0,
        dropped: 0,
        errors: queries - answered,
        blockedPercentage: 0,
        cacheHitRate: (cached / (cached + forwarded)) * 100,
        listedDomains: 500,
        avgResponseMs: latency,
        cacheEntries: 100,
        denylistGroups: 1,
        allowlistDomains: 10,
      },
      topLists: { domains: [], blockedDomains: [], clients: [] },
      queriesOverTime: [],
    },
  } satisfies Result;
}

describe("combined server statistics", () => {
  it("weights cache rates by lookups and latency by answered queries", () => {
    const summary = aggregateStatistics([
      result("a", {
        queries: 100,
        cached: 90,
        forwarded: 10,
        answered: 100,
        latency: 10,
      }),
      result("b", {
        queries: 1000,
        cached: 1,
        forwarded: 9,
        answered: 10,
        latency: 100,
      }),
      {
        serverId: "offline",
        success: false,
        error: { kind: "connection", message: "Unable to reach the server." },
      },
    ]);
    expect(summary?.totalQueries).toBe(1100);
    expect(summary?.cacheHitRate).toBeCloseTo((91 / 110) * 100);
    expect(summary?.avgResponseMs).toBe(18);
    expect(summary?.cacheEntries).toBe(200);
    expect(summary).not.toHaveProperty("listedDomains");
  });

  it("does not turn missing statistics into zero traffic", () => {
    expect(aggregateStatistics([])).toBeNull();
  });
});

describe("hourly server traffic", () => {
  function traffic(
    serverId: string,
    points: { time: string; total: number; blocked: number }[],
  ): Result {
    const snapshot = result(serverId, {
      queries: 100,
      cached: 60,
      forwarded: 30,
      answered: 100,
      latency: 10,
    });
    return { ...snapshot, data: { ...snapshot.data, queriesOverTime: points } };
  }

  it("sums matching hours, sorts disjoint hours, and does not mutate snapshots", () => {
    const a = traffic("a", [
      { time: "2026-09-13T10:00:00.000Z", total: 10, blocked: 2 },
      { time: "2026-09-13T08:00:00.000Z", total: 20, blocked: 3 },
    ]);
    const b = traffic("b", [
      { time: "2026-09-13T09:00:00.000Z", total: 30, blocked: 4 },
      { time: "2026-09-13T10:00:00.000Z", total: 40, blocked: 5 },
    ]);
    const original = structuredClone([a, b]);
    expect(aggregateStatisticsTraffic([a, b])).toEqual([
      { time: "2026-09-13T08:00:00.000Z", total: 20, blocked: 3 },
      { time: "2026-09-13T09:00:00.000Z", total: 30, blocked: 4 },
      { time: "2026-09-13T10:00:00.000Z", total: 50, blocked: 7 },
    ]);
    expect([a, b]).toEqual(original);
  });

  it("distinguishes unavailable statistics from an empty history after restart", () => {
    const offline: Result = {
      serverId: "offline",
      success: false,
      error: { kind: "connection", message: "Unable to reach the server." },
    };
    expect(aggregateStatisticsTraffic([])).toBeNull();
    expect(aggregateStatisticsTraffic([offline])).toBeNull();
    expect(
      aggregateStatisticsTraffic([offline, traffic("restarted", [])]),
    ).toEqual([]);
  });

  it("fills quiet hours between reported buckets without extending the history", () => {
    const sparse = traffic("a", [
      { time: "2026-09-13T10:00:00.000Z", total: 10, blocked: 2 },
      { time: "2026-09-13T08:00:00.000Z", total: 20, blocked: 3 },
    ]);
    expect(aggregateStatisticsTraffic([sparse])).toEqual([
      { time: "2026-09-13T08:00:00.000Z", total: 20, blocked: 3 },
      { time: "2026-09-13T09:00:00.000Z", total: 0, blocked: 0 },
      { time: "2026-09-13T10:00:00.000Z", total: 10, blocked: 2 },
    ]);
  });
});
