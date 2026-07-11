import { describe, expect, it } from "vitest";
import {
  DEFAULT_DEMO_SETUP,
  DEMO_SETUPS,
  DEMO_SETUP_HEADER,
  getDemoSetup,
  getDemoSetupFromHeaders,
} from "~/demo/config";

describe("demo configuration", () => {
  it.each(DEMO_SETUPS)("resolves the $id preset", (setup) => {
    expect(getDemoSetup(setup.id)).toBe(setup);
  });

  it.each([undefined, null, "unknown"])(
    "defaults an invalid value to the complete setup",
    (value) => {
      expect(getDemoSetup(value)).toBe(DEFAULT_DEMO_SETUP);
    },
  );

  it("reads the setup from the request header", () => {
    const headers = new Headers({ [DEMO_SETUP_HEADER]: "api-only" });

    expect(getDemoSetupFromHeaders(headers).id).toBe("api-only");
  });
});
