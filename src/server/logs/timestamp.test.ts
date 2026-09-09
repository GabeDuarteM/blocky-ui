import { expect, it } from "vitest";
import { normalizeLogTimestamp } from "~/server/logs/timestamp";

it.each([
  ["2026-09-05 12:30:00.100", "2026-09-05T12:30:00.100Z"],
  ["2026-09-05 12:30:00.1+00", "2026-09-05T12:30:00.100Z"],
  ["2026-09-05T14:30:00.1+02:00", "2026-09-05T12:30:00.100Z"],
  ["2026-09-05T12:30:00Z", "2026-09-05T12:30:00.000Z"],
  [null, null],
  ["invalid", null],
])(
  "normalizes timestamps independently of the dashboard host timezone",
  (input, expected) => {
    expect(normalizeLogTimestamp(input)).toBe(expected);
  },
);
