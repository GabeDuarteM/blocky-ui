import { describe, expect, it } from "vitest";
import ky from "ky";

import {
  createStatisticsSnapshot,
  readBlockyStatistics,
  type BlockyStatistics,
} from "~/server/blocky/statistics";

function createStatistics(
  overrides?: Partial<BlockyStatistics>,
): BlockyStatistics {
  return {
    perHour: [],
    byResponseType: { CACHED: 90, RESOLVED: 60, BLOCKED: 50 },
    summary: {
      queries: 200,
      cached: 90,
      forwarded: 30,
      blocked: 50,
      dropped: 0,
      errors: 0,
      avgResponseMs: 10,
      cacheHitRate: 0.75,
    },
    topDomains: [{ name: "example.com", count: 40 }],
    topBlockedDomains: [{ name: "ads.example.com", count: 20 }],
    topClients: [{ name: "laptop", count: 80 }],
    lists: {
      denylist: { ads: 1200, malware: 300 },
      allowlist: { default: 25 },
    },
    cache: { entries: 100 },
    ...overrides,
  };
}

describe("createStatisticsSnapshot", () => {
  it("maps the 24-hour summary and point-in-time denylist counts", () => {
    expect(createStatisticsSnapshot(createStatistics())).toEqual({
      queriesOverTime: [],
      overview: {
        totalQueries: 200,
        blocked: 50,
        dropped: 0,
        errors: 0,
        blockedPercentage: 25,
        cacheHitRate: 75,
        listedDomains: 1500,
        avgResponseMs: 10,
        cacheEntries: 100,
        denylistGroups: 2,
        allowlistDomains: 25,
      },
      topLists: {
        domains: [{ name: "example.com", count: 40 }],
        blockedDomains: [{ name: "ads.example.com", count: 20 }],
        clients: [{ name: "laptop", count: 80 }],
      },
    });
  });

  it("reads hourly traffic from the API without inventing cached counts", async () => {
    const client = ky.create({
      prefix: "http://blocky.test/",
      fetch: async (request) => {
        expect(new Request(request).url).toBe("http://blocky.test/api/stats");
        return Response.json(
          createStatistics({
            perHour: [
              {
                hour: "2026-09-13T10:00:00+02:00",
                queries: 200,
                blocked: 50,
              },
            ],
          }),
        );
      },
    });
    const snapshot = createStatisticsSnapshot(
      await readBlockyStatistics(client),
    );
    expect(snapshot.queriesOverTime).toEqual([
      { time: "2026-09-13T08:00:00.000Z", total: 200, blocked: 50 },
    ]);
  });

  it("returns a zero blocked percentage when no queries were recorded", () => {
    const statistics = createStatistics({
      byResponseType: {},
      summary: {
        queries: 0,
        cached: 0,
        forwarded: 0,
        blocked: 0,
        dropped: 0,
        errors: 0,
        avgResponseMs: 0,
        cacheHitRate: 0,
      },
    });

    expect(
      createStatisticsSnapshot(statistics).overview.blockedPercentage,
    ).toBe(0);
  });
});
