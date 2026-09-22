import { expect, it } from "vitest";
import { getMockLogEntries } from "./log-entry-mock";

it("generates the same demo data for the same time", () => {
  const now = Date.UTC(2026, 0, 15, 12);
  expect(getMockLogEntries(now)).toEqual(getMockLogEntries(now));
});

it("keeps demo data recent as time passes without changing its distribution", () => {
  const firstTime = Date.UTC(2026, 0, 15, 12);
  const laterTime = Date.UTC(2026, 3, 15, 12);
  const first = getMockLogEntries(firstTime);
  const later = getMockLogEntries(laterTime);

  expect(later.map(({ requestTs: _requestTs, ...entry }) => entry)).toEqual(
    first.map(({ requestTs: _requestTs, ...entry }) => entry),
  );
  const ages = (entries: typeof first, now: number) =>
    entries.map((entry) => now - Date.parse(entry.requestTs ?? ""));
  expect(ages(later, laterTime)).toEqual(ages(first, firstTime));
  expect(Math.min(...ages(later, laterTime))).toBeGreaterThanOrEqual(0);
  expect(Math.min(...ages(later, laterTime))).toBeLessThan(24 * 60 * 60 * 1000);
  expect(Math.max(...ages(later, laterTime))).toBeLessThanOrEqual(
    7 * 24 * 60 * 60 * 1000,
  );
});
