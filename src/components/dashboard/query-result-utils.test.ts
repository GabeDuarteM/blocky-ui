import { describe, expect, it } from "vitest";
import { getQueryResultDetail } from "~/components/dashboard/query-result-utils";

describe("getQueryResultDetail", () => {
  it.each([
    ["BLOCKED", "BLOCKED (telemetry: [...])", "telemetry"],
    ["BLOCKED", "blocked (telemetry: [...])", "telemetry"],
    ["BLOCKED", "BLOCKED CNAME (ads: *.example.com)", "ads"],
    ["BLOCKED", "BLOCKED (alpha: a.example, mid: m.example)", "alpha"],
  ])("shows only blocking groups for %s / %s", (type, reason, expected) => {
    expect(getQueryResultDetail(type, reason)).toBe(expected);
  });

  it.each([
    ["BLOCKED", "BLOCKED"],
    ["BLOCKED", "BLOCKED (ALLOWLIST ONLY)"],
    ["CACHED", "CACHED"],
  ])("hides redundant details for %s / %s", (type, reason) => {
    expect(getQueryResultDetail(type, reason)).toBeNull();
  });

  it("keeps a distinct non-blocked reason", () => {
    expect(getQueryResultDetail("RESOLVED", "CONDITIONAL")).toBe("CONDITIONAL");
  });
});
