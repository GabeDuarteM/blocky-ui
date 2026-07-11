import { describe, expect, it } from "vitest";

import {
  createStatisticsSnapshot,
  parseBlockyStatistics,
  type BlockyStatistics,
} from "~/server/blocky/statistics";

function createStatistics(
  overrides?: Partial<BlockyStatistics>,
): BlockyStatistics {
  return {
    summary: {
      queries: 200,
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

  it("returns a zero blocked percentage when no queries were recorded", () => {
    const statistics = createStatistics({
      summary: {
        queries: 0,
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

describe("parseBlockyStatistics", () => {
  it("keeps the fields used by BlockyUI and ignores the rest", () => {
    const statistics = createStatistics();

    expect(
      parseBlockyStatistics({
        ...statistics,
        start: "2026-07-10T12:00:00Z",
        end: "2026-07-11T12:00:00Z",
        byResponseType: { BLOCKED: 50 },
        perHour: [],
      }),
    ).toEqual(statistics);
  });

  it("returns null for a malformed payload", () => {
    expect(parseBlockyStatistics({ summary: {} })).toBeNull();
  });
});
