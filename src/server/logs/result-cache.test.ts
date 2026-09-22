import { describe, expect, it, vi } from "vitest";
import { createResultCache } from "~/server/logs/result-cache";

describe("result cache", () => {
  it("returns oversized results without retaining them", async () => {
    const cache = createResultCache<number[]>({
      ttlMs: 1000,
      maxEntries: 10,
      maxWeight: 3,
      weightOf: (items) => items.length,
    });
    const oversized = vi.fn(() => Promise.resolve([1, 2, 3, 4]));
    expect(await cache.get("large", oversized)).toEqual([1, 2, 3, 4]);
    await cache.get("large", oversized);
    expect(oversized).toHaveBeenCalledTimes(2);
    const small = vi.fn(() => Promise.resolve([1]));
    await cache.get("small", small);
    await cache.get("small", small);
    expect(small).toHaveBeenCalledTimes(1);
  });
  it("shares in-flight work and starts freshness when the slow query finishes", async () => {
    let time = 0;
    const cache = createResultCache<number>({
      ttlMs: 30,
      maxEntries: 2,
      now: () => time,
    });
    let resolve: (value: number) => void = () => undefined;
    const load = vi.fn(
      () =>
        new Promise<number>((done) => {
          resolve = done;
        }),
    );
    const first = cache.get("filter", load);
    expect(cache.get("filter", load)).toBe(first);
    await Promise.resolve();
    time = 100;
    resolve(5);
    expect(await first).toBe(5);
    time = 129;
    expect(await cache.get("filter", load)).toBe(5);
    expect(load).toHaveBeenCalledTimes(1);
    time = 130;
    expect(await cache.get("filter", () => Promise.resolve(6))).toBe(6);
  });

  it("evicts failed queries and the least recently used completed entry", async () => {
    const cache = createResultCache<number>({ ttlMs: 1000, maxEntries: 2 });
    await expect(
      cache.get("failed", () => Promise.reject(new Error("offline"))),
    ).rejects.toThrow("offline");
    expect(await cache.get("failed", () => Promise.resolve(1))).toBe(1);
    await cache.get("second", () => Promise.resolve(2));
    await cache.get("failed", () => Promise.resolve(9));
    await cache.get("third", () => Promise.resolve(3));
    expect(await cache.get("second", () => Promise.resolve(4))).toBe(4);
  });
});
