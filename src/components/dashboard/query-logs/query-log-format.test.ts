import { describe, expect, it } from "vitest";
import {
  formatQueryDuration,
  getQueryReason,
} from "~/components/dashboard/query-logs/query-log-format";
import { BLOCKY_RESPONSE_TYPES } from "~/lib/constants";

describe("query reason presentation", () => {
  it.each(BLOCKY_RESPONSE_TYPES)(
    "keeps %s readable without an icon",
    (responseType) => {
      expect(getQueryReason({ reason: null, responseType }).label).toBe(
        responseType,
      );
    },
  );

  it.each([
    ["BLOCKED (ads)", "BLOCKED", "BLOCKED", "Group: ads"],
    [
      "RESOLVED (https://dns.example/dns-query)",
      "RESOLVED",
      "RESOLVED",
      "Resolved by: https://dns.example/dns-query",
    ],
    ["CACHED (prefetched)", "CACHED", "CACHED", "prefetched"],
    ["CUSTOM RULE", "CUSTOMDNS", "CUSTOM RULE", null],
    ["RESOLVED", "RESOLVED", "RESOLVED", null],
    [null, "REBIND", "REBIND", "Blocked by DNS rebinding protection"],
    [null, null, "Unknown", null],
  ])(
    "preserves the label and context for %s",
    (reason, responseType, label, detail) => {
      expect(getQueryReason({ reason, responseType })).toEqual({
        label,
        detail,
      });
    },
  );
});

describe("query duration presentation", () => {
  it.each([
    [null, "CACHED", "Unknown"],
    [0, "CACHED", "Local"],
    [0, "BLOCKED", "Local"],
    [0, "RESOLVED", "0 ms"],
    [42, "RESOLVED", "42 ms"],
  ] as const)(
    "formats %s milliseconds for %s",
    (durationMs, responseType, expected) => {
      expect(formatQueryDuration({ durationMs, responseType })).toBe(expected);
    },
  );
});
