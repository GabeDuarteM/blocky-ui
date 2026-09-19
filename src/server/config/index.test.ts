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

async function writeYamlConfiguration(contents: string) {
  const path = join(directory, "blocky-ui.yml");
  await writeFile(path, contents);
  vi.stubEnv("BLOCKY_UI_CONFIG", path);
}

async function useYamlLogSources(logSources: Configuration["logSources"]) {
  await writeYamlConfiguration(
    stringify({
      servers: {
        nas: { url: "http://configured:4000", logs: { source: "home" } },
      },
      logSources,
    }),
  );
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

describe("separate database connection fields", () => {
  it.each(["mysql", "postgresql", "timescale"] as const)(
    "loads a shared password secret for %s without changing its contents",
    async (type) => {
      const path = join(directory, "password");
      const password = " p@ss:/?#%word ";
      await writeFile(path, `${password}\r\n`);
      await useYamlLogSources({
        home: {
          type,
          target: {
            host: "db",
            port: 1234,
            username: "user@home",
            password: `file:${path}`,
            database: "query logs",
            options: {
              connect_timeout: 15,
              prepare: false,
              connection: { application_name: "shared secret" },
            },
          },
        },
      });

      const { getConfiguration } = await import("~/server/config");
      const target = (await getConfiguration()).logSources.home?.target;
      expect(target).toEqual({
        host: "db",
        port: 1234,
        username: "user@home",
        password,
        database: "query logs",
        options: {
          connect_timeout: 15,
          prepare: false,
          connection: { application_name: "shared secret" },
        },
      });
    },
  );

  it("keeps inline passwords literal and uses the driver's default port", async () => {
    await useYamlLogSources({
      home: {
        type: "mysql",
        target: {
          host: "db",
          username: "blocky",
          password: "p%40ss",
          database: "blocky",
        },
      },
    });
    const { getConfiguration } = await import("~/server/config");
    expect((await getConfiguration()).logSources.home?.target).toEqual({
      host: "db",
      username: "blocky",
      password: "p%40ss",
      database: "blocky",
    });
  });

  it("reports an unreadable password file without exposing its path", async () => {
    await useYamlLogSources({
      home: {
        type: "mysql",
        target: {
          host: "db",
          username: "blocky",
          password: `file:${join(directory, "missing")}`,
          database: "blocky",
        },
      },
    });
    const { getConfiguration } = await import("~/server/config");
    await expect(getConfiguration()).rejects.toThrow(
      /^Cannot read the file configured by logSources.home.target.password$/,
    );
  });
});

describe("provider option files", () => {
  it.each(["mysql", "postgresql", "timescale"] as const)(
    "resolves nested option files for %s once and preserves other values",
    async (type) => {
      const path = join(directory, "certificate");
      const contents = "file:/not-another-reference\nPEM contents\n";
      await writeFile(path, `${contents}\r\n`);
      const hostPath = join(directory, "host");
      const usernamePath = join(directory, "username");
      const databasePath = join(directory, "database");
      await writeFile(hostPath, "db\n");
      await writeFile(usernamePath, "blocky\n");
      await writeFile(databasePath, "blocky\n");
      const options = {
        ssl: { ca: [`file:${path}`, `file://${path}`, "inline certificate"] },
        passphrase: `file:${path}`,
        enabled: false,
        timeout: 15,
        nullable: null,
        empty: "",
        emptyArray: [],
        emptyObject: {},
        "file:literal-key": "unchanged",
      };
      await useYamlLogSources({
        home: {
          type,
          target: {
            host: `file:${hostPath}`,
            username: `file://${usernamePath}`,
            password: "secret",
            database: `file:${databasePath}`,
            options,
          },
        },
      });
      const { getConfiguration } = await import("~/server/config");
      expect((await getConfiguration()).logSources.home?.target).toMatchObject({
        host: "db",
        username: "blocky",
        database: "blocky",
        options: {
          ...options,
          ssl: { ca: [contents, contents, "inline certificate"] },
          passphrase: contents,
        },
      });
    },
  );

  it("identifies an unreadable nested option without exposing its file path", async () => {
    await useYamlLogSources({
      home: {
        type: "postgresql",
        target: {
          host: "db",
          username: "blocky",
          password: "secret",
          database: "blocky",
          options: { ssl: { ca: [`file:${join(directory, "missing")}`] } },
        },
      },
    });
    const { getConfiguration } = await import("~/server/config");
    await expect(getConfiguration()).rejects.toThrow(
      /^Cannot read the file configured by logSources.home.target.options.ssl.ca.0$/,
    );
  });
});

it.each([
  { field: "host", contents: "", error: "logSources.home.target.host" },
  { field: "username", contents: "", error: "logSources.home.target.username" },
  { field: "database", contents: "", error: "logSources.home.target.database" },
  { field: "host", contents: "::1", error: "IPv6 addresses are not supported" },
])(
  "validates loaded $field value '$contents'",
  async ({ field, contents, error }) => {
    const path = join(directory, "field");
    await writeFile(path, contents);
    await useYamlLogSources({
      home: {
        type: "postgresql",
        target: {
          host: "db",
          username: "blocky",
          password: "secret",
          database: "blocky",
          [field]: `file:${path}`,
        },
      },
    });
    const { getConfiguration } = await import("~/server/config");
    await expect(getConfiguration()).rejects.toThrow(error);
  },
);

describe("raw YAML strings", () => {
  it.each(["mysql", "postgresql", "timescale"])(
    "preserves tagged %s fields while resolving neighboring file references",
    async (type) => {
      const secretPath = join(directory, "secret");
      await writeFile(secretPath, "loaded value\n");
      await writeYamlConfiguration(`
servers: {nas: {url: 'http://blocky:4000'}}
logSources:
  home:
    type: ${type}
    target:
      host: !raw file:host
      username: !raw file:username
      password: !raw " file:password "
      database: !raw file:database
      options:
        connection:
          application_name: !raw file:worker
        certs: [!raw file:literal, file:${secretPath}]
        nested:
          - ca: !raw file:ca
        literal: "!raw file:ordinary-string"
        file: !raw file:value
        dotted.key: !raw file:dotted
        dotted: {key: file:${secretPath}}
        empty: !raw ""
        numberText: !raw 123
        numericKeys: {1: !raw file:one, 2: file:${secretPath}}
`);
      const { getConfiguration } = await import("~/server/config");
      expect((await getConfiguration()).logSources.home?.target).toEqual({
        host: "file:host",
        username: "file:username",
        password: " file:password ",
        database: "file:database",
        options: {
          connection: { application_name: "file:worker" },
          certs: ["file:literal", "loaded value"],
          nested: [{ ca: "file:ca" }],
          literal: "!raw file:ordinary-string",
          file: "file:value",
          "dotted.key": "file:dotted",
          dotted: { key: "loaded value" },
          empty: "",
          numberText: "123",
          numericKeys: { "1": "file:one", "2": "loaded value" },
        },
      });
    },
  );

  it.each(["sqlite", "csv", "csv-client", "mysql", "postgresql", "timescale"])(
    "preserves a tagged whole %s target",
    async (type) => {
      await writeYamlConfiguration(`
servers: {nas: {url: 'http://blocky:4000'}}
logSources:
  home: {type: ${type}, target: !raw 'file:/logs/database.db?mode=ro'}
`);
      const { getConfiguration } = await import("~/server/config");
      expect((await getConfiguration()).logSources.home?.target).toBe(
        "file:/logs/database.db?mode=ro",
      );
    },
  );

  it("preserves raw tags through scalar and collection aliases without affecting equal untagged values", async () => {
    const secretPath = join(directory, "secret");
    await writeFile(secretPath, "loaded value\n");
    await writeYamlConfiguration(`
servers: {nas: {url: 'http://blocky:4000'}}
logSources:
  home:
    type: mysql
    target: &target
      host: db
      username: blocky
      password: &password !raw file:${secretPath}
      database: blocky
      options:
        aliased: *password
        loaded: file:${secretPath}
        group: &group {literal: *password, loaded: file:${secretPath}}
        reused: *group
        array: &array [*password, file:${secretPath}]
        reusedArray: *array
  other:
    type: mysql
    target: *target
`);
    const { getConfiguration } = await import("~/server/config");
    const config = await getConfiguration();
    const raw = `file:${secretPath}`;
    const expected = {
      password: raw,
      options: {
        aliased: raw,
        loaded: "loaded value",
        group: { literal: raw, loaded: "loaded value" },
        reused: { literal: raw, loaded: "loaded value" },
        array: [raw, "loaded value"],
        reusedArray: [raw, "loaded value"],
      },
    };
    expect(config.logSources.home?.target).toMatchObject(expected);
    expect(config.logSources.other?.target).toMatchObject(expected);
  });
});

it("keeps raw metadata aligned with YAML null keys and merge aliases", async () => {
  const secretPath = join(directory, "secret");
  await writeFile(secretPath, "loaded value\n");
  await writeYamlConfiguration(`%YAML 1.1
---
servers: {nas: {url: 'http://blocky:4000'}}
logSources:
  home:
    type: mysql
    target: &target
      host: db
      username: blocky
      password: !raw file:password
      database: blocky
      options: &options
        nullKeys:
          "null": file:${secretPath}
          null: !raw file:literal
  merged:
    type: mysql
    target:
      <<: *target
      options:
        <<: *options
        extra: file:${secretPath}
  overridden:
    type: mysql
    target:
      <<: *target
      password: file:${secretPath}
`);
  const { getConfiguration } = await import("~/server/config");
  const config = await getConfiguration();
  expect(config.logSources.home?.target).toMatchObject({
    password: "file:password",
    options: { nullKeys: { null: "loaded value", "": "file:literal" } },
  });
  expect(config.logSources.merged?.target).toMatchObject({
    password: "file:password",
    options: {
      nullKeys: { null: "loaded value", "": "file:literal" },
      extra: "loaded value",
    },
  });
  expect(config.logSources.overridden?.target).toMatchObject({
    password: "loaded value",
  });
});
