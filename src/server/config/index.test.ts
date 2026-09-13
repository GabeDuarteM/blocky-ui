import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, relative } from "node:path";
import { stringify } from "yaml";
import { type Configuration } from "~/server/config/schema";

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

async function useYamlLogSources(logSources: Configuration["logSources"]) {
  const path = join(directory, "blocky-ui.yml");
  await writeFile(
    path,
    stringify({
      servers: {
        nas: { url: "http://configured:4000", logs: { source: "home" } },
      },
      logSources,
    }),
  );
  vi.stubEnv("BLOCKY_UI_CONFIG", path);
}

describe("YAML log target secrets", () => {
  it.each([
    "mysql",
    "postgresql",
    "timescale",
    "sqlite",
    "csv",
    "csv-client",
    "console",
  ] as const)("resolves a file target for %s", async (type) => {
    const path = join(directory, "target");
    const target = "mysql://user:password@db/blocky";
    await writeFile(path, target);
    await useYamlLogSources({
      home: {
        type,
        target: `file:${path}`,
        ...(type === "console" ? { consoleProvider: "victorialogs" } : {}),
      },
    });

    const { getConfiguration } = await import("~/server/config");
    expect((await getConfiguration()).logSources.home?.target).toBe(target);
  });

  it.each(["file:", "file://"])("accepts the %s prefix", async (prefix) => {
    const path = join(directory, "target with spaces");
    await writeFile(path, "/data/query logs");
    await useYamlLogSources({
      home: { type: "csv", target: `${prefix}${path}` },
    });

    const { getConfiguration } = await import("~/server/config");
    expect((await getConfiguration()).logSources.home?.target).toBe(
      "/data/query logs",
    );
  });

  it.each([
    ["value", "value"],
    ["value\n", "value"],
    ["value\r\n", "value"],
    ["value\n\n", "value\n"],
    [" value \r\n", " value "],
    ["value\r", "value\r"],
  ])("matches Blocky's newline handling for %j", async (contents, expected) => {
    const path = join(directory, "target");
    await writeFile(path, contents);
    await useYamlLogSources({ home: { type: "csv", target: `file:${path}` } });

    const { getConfiguration } = await import("~/server/config");
    expect((await getConfiguration()).logSources.home?.target).toBe(expected);
  });

  it("resolves relative paths from the working directory, as Blocky does", async () => {
    const path = join(directory, "target");
    await writeFile(path, "/data/logs");
    await useYamlLogSources({
      home: { type: "csv", target: `file:${relative(process.cwd(), path)}` },
    });

    const { getConfiguration } = await import("~/server/config");
    expect((await getConfiguration()).logSources.home?.target).toBe(
      "/data/logs",
    );
  });

  it("resolves independent sources once and preserves inline targets", async () => {
    const home = join(directory, "home");
    const office = join(directory, "office");
    await writeFile(home, "/home/logs");
    await writeFile(office, "/office/logs");
    await useYamlLogSources({
      home: { type: "csv", target: `file:${home}` },
      office: { type: "csv", target: `file:${office}` },
      inline: { type: "csv", target: "/inline/logs " },
    });

    const { getConfiguration } = await import("~/server/config");
    const config = await getConfiguration();
    expect(config.logSources).toEqual({
      home: { type: "csv", target: "/home/logs" },
      office: { type: "csv", target: "/office/logs" },
      inline: { type: "csv", target: "/inline/logs " },
    });
    await writeFile(home, "/changed");
    expect(await getConfiguration()).toBe(config);
  });

  it("uses file contents literally without resolving a second file reference", async () => {
    const path = join(directory, "target");
    await writeFile(path, "file:/do-not-read");
    await useYamlLogSources({ home: { type: "csv", target: `file:${path}` } });

    const { getConfiguration } = await import("~/server/config");
    expect((await getConfiguration()).logSources.home?.target).toBe(
      "file:/do-not-read",
    );
  });

  it.each(["missing", "."])(
    "rejects unreadable file %s without exposing its path",
    async (name) => {
      await useYamlLogSources({
        home: { type: "csv", target: `file:${join(directory, name)}` },
      });

      const { getConfiguration } = await import("~/server/config");
      await expect(getConfiguration()).rejects.toThrow(
        /^Cannot read the file configured by logSources.home.target$/,
      );
    },
  );

  it.each(["", "\n", "\r\n"])(
    "rejects an empty resolved target %j",
    async (contents) => {
      const path = join(directory, "target");
      await writeFile(path, contents);
      await useYamlLogSources({
        home: { type: "csv", target: `file:${path}` },
      });

      const { getConfiguration } = await import("~/server/config");
      await expect(getConfiguration()).rejects.toThrow(
        /^Invalid Blocky UI configuration at: logSources.home.target$/,
      );
    },
  );
});
