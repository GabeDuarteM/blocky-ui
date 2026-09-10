import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

beforeEach(async () => {
  vi.resetModules();
  vi.stubEnv("BLOCKY_UI_CONFIG", "");
  vi.stubEnv("BLOCKY_API_URL", "http://legacy:4000");
  vi.stubEnv("BLOCKY_REQUEST_HEADERS", '{"Authorization":"test-only"}');
  vi.stubEnv("QUERY_LOG_TYPE", "csv");
  vi.stubEnv("QUERY_LOG_TARGET", "/legacy/logs");
  vi.stubEnv("QUERY_LOG_CONSOLE_PROVIDER", "");
  vi.stubEnv("DEMO_MODE", "false");
});
afterEach(async () => {
  vi.unstubAllEnvs();
});

describe("configuration loading", () => {
  it("keeps existing environment-only deployments working", async () => {
    const { getConfiguration } = await import("~/server/config");
    const config = await getConfiguration();
    expect(config.servers.default).toMatchObject({
      url: "http://legacy:4000",
      headers: { Authorization: "test-only" },
      logs: { source: "default" },
    });
    expect(config.logSources.default).toEqual({
      type: "csv",
      target: "/legacy/logs",
    });
  });

  it("allows demo logs without a real source target", async () => {
    vi.stubEnv("DEMO_MODE", "true");
    vi.stubEnv("QUERY_LOG_TARGET", "");
    const { getConfiguration } = await import("~/server/config");
    expect((await getConfiguration()).servers.default?.logs).toEqual({
      source: "default",
    });
  });
});
