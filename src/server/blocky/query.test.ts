import { describe, expect, it } from "vitest";

import { parseBlockyQueryResult } from "~/server/blocky/query";

function createResult(reason: string, responseType = "BLOCKED") {
  return parseBlockyQueryResult({
    reason,
    response: "",
    responseType,
    returnCode: "NOERROR",
  });
}

describe("parseBlockyQueryResult", () => {
  it("normalizes DNS answers", () => {
    expect(
      parseBlockyQueryResult({
        reason: "RESOLVED",
        response: "A (192.0.2.1), A (192.0.2.2)",
        responseType: "RESOLVED",
        returnCode: "NOERROR",
      }),
    ).toEqual({
      responseType: "RESOLVED",
      returnCode: "NOERROR",
      answers: ["192.0.2.1", "192.0.2.2"],
      detail: null,
    });
  });

  it.each([
    ["BLOCKED (telemetry: [...])", "telemetry"],
    ["blocked (telemetry: [...])", "telemetry"],
    ["BLOCKED CNAME (ads: *.example.com)", "ads"],
    ["BLOCKED (alpha: a.example, mid: m.example)", "alpha, mid"],
  ])("shows blocking groups for %s", (reason, expected) => {
    expect(createResult(reason).detail).toBe(expected);
  });

  it.each(["BLOCKED", "BLOCKED (ALLOWLIST ONLY)"])(
    "hides a blocked reason without a group for %s",
    (reason) => {
      expect(createResult(reason).detail).toBeNull();
    },
  );

  it("keeps a distinct non-blocked reason", () => {
    expect(createResult("CONDITIONAL", "RESOLVED").detail).toBe("CONDITIONAL");
  });
});
