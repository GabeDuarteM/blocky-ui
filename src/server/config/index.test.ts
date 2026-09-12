import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

let directory: string;
beforeEach(async () => {
  vi.resetModules();
  directory = await mkdtemp(join(tmpdir(), "blocky-config-"));
  vi.stubEnv("BLOCKY_UI_CONFIG", "");
  vi.stubEnv("BLOCKY_API_URL", "http://legacy:4000");
  vi.stubEnv("BLOCKY_REQUEST_HEADERS", '{"Authorization":"test-only"}');
  vi.stubEnv("QUERY_LOG_TYPE", "csv");
  vi.stubEnv("QUERY_LOG_TARGET", "/legacy/logs");
  vi.stubEnv("QUERY_LOG_CONSOLE_PROVIDER", "");
  vi.stubEnv("DEMO_MODE", "false");
  vi.stubEnv("INSTANCE_NAME", "Legacy name");
});
afterEach(async () => {
  vi.unstubAllEnvs();
  await rm(directory, { recursive: true, force: true });
});

describe("configuration loading", () => {
  it("keeps existing environment-only deployments working", async () => {
    const { getConfiguration } = await import("~/server/config");
    const config = await getConfiguration();
    expect(config.instanceName).toBe("Legacy name");
    expect(config.demoMode).toBe(false);
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

  it("uses the file exclusively, even if ignored legacy settings are invalid", async () => {
    const path = join(directory, "blocky-ui.yml");
    await writeFile(path, "servers:\n  nas: {url: 'http://configured:4000'}\n");
    vi.stubEnv("BLOCKY_UI_CONFIG", path);
    vi.stubEnv("BLOCKY_API_URL", "invalid URL");
    vi.stubEnv("BLOCKY_REQUEST_HEADERS", "invalid JSON");
    vi.stubEnv("QUERY_LOG_TYPE", "invalid provider");
    const { getConfiguration } = await import("~/server/config");
    const config = await getConfiguration();
    expect(config.servers.nas).toEqual({
      url: "http://configured:4000",
      headers: {},
    });
    expect(config.logSources).toEqual({});
    expect(config.instanceName).toBeUndefined();
    expect(config.demoMode).toBe(false);
    await writeFile(
      path,
      "servers:\n  changed: {url: 'http://changed:4000'}\n",
    );
    expect(await getConfiguration()).toBe(config);
  });

  it.each([true, false])(
    "loads demoMode=%s and the tab name from YAML",
    async (demoMode) => {
      const path = join(directory, "blocky-ui.yml");

      await writeFile(
        path,
        `instanceName: Home DNS
demoMode: ${demoMode}
servers:
  nas: {url: 'http://configured:4000'}
`,
      );
      vi.stubEnv("BLOCKY_UI_CONFIG", path);
      vi.stubEnv("DEMO_MODE", String(!demoMode));

      const { getConfiguration } = await import("~/server/config");
      const config = await getConfiguration();

      expect(config.instanceName).toBe("Home DNS");
      expect(config.demoMode).toBe(demoMode);
    },
  );

  it("does not silently fall back when the configured file is missing", async () => {
    vi.stubEnv("BLOCKY_UI_CONFIG", join(directory, "missing.yml"));
    const { getConfiguration } = await import("~/server/config");
    await expect(getConfiguration()).rejects.toThrow(
      "Cannot read the file configured by BLOCKY_UI_CONFIG",
    );
  });

  it("allows demo logs without a real source target", async () => {
    vi.stubEnv("DEMO_MODE", "true");
    vi.stubEnv("QUERY_LOG_TARGET", "");
    const { getConfiguration } = await import("~/server/config");
    expect((await getConfiguration()).demoMode).toBe(true);
    expect((await getConfiguration()).servers.default?.logs).toEqual({
      source: "default",
    });
  });
});
