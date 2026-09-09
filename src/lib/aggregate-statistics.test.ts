import { describe, expect, it } from "vitest";
import { aggregateStatistics } from "~/lib/aggregate-statistics";
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
): Result {
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
    },
  };
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
