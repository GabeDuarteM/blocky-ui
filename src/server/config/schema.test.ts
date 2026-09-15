import { describe, expect, it } from "vitest";
import { parseConfigurationYaml } from "~/server/config/schema";

describe("server configuration", () => {
  it("keeps connections independent while referencing one shared log source", () => {
    const config = parseConfigurationYaml(`
servers:
  nas:
    url: http://blocky:4000
    headers:
      Authorization: Bearer private-token
    logs: {source: shared, hostname: blocky}
  raspberry:
    url: http://raspberry:4000
    logs: {source: shared, hostname: blocky-raspberry}
  without-logs:
    url: https://third.example
logSources:
  shared: {type: mysql, target: 'mysql://user:password@db/blocky'}
`);

    expect(Object.keys(config.logSources)).toEqual(["shared"]);
    expect(config.servers.raspberry?.logs).toEqual({
      source: "shared",
      hostname: "blocky-raspberry",
    });
    expect(config.servers.nas?.headers.Authorization).toBe(
      "Bearer private-token",
    );
    expect(config.servers["without-logs"]?.headers).toEqual({});
  });

  it.each([
    "servers: {}",
    "servers: {one: {url: 'http://one'}}\ndemoMode: yes",
    "servers: {one: {url: 'http://one'}}\ninstanceName: 42",
    "servers: {one: {url: file:///private}}",
    "servers: {one: {url: 'http://one', logs: {source: missing}}}",
    "servers: {one: {url: 'http://one', urls: 'http://two'}}",
    "servers: {one: {url: 'http://one', logs: {source: shared, hostname: [old, new]}}}",
    "servers: {one: {url: 'http://one'}}\nlogSources: {shared: {type: console, target: 'http://logs'}}",
  ])("rejects invalid or ambiguous settings: %s", (contents) => {
    expect(() => parseConfigurationYaml(contents)).toThrow(
      "Invalid Blocky UI configuration",
    );
  });

  it("rejects duplicate YAML keys rather than silently replacing a server", () => {
    expect(() =>
      parseConfigurationYaml(
        "servers:\n  one: {url: 'http://one'}\n  one: {url: 'http://two'}",
      ),
    ).toThrow("Invalid YAML");
  });

  it("does not include credentials in malformed YAML errors", () => {
    expect(() =>
      parseConfigurationYaml("servers: [secret-token: {broken"),
    ).toThrow(/^Invalid YAML in Blocky UI configuration$/);
  });
});

describe("database target validation", () => {
  it.each([
    { type: "csv" },
    { type: "postgresql", target: { host: "2001:db8::1" } },
    { type: "timescale", target: { host: "2001:db8::1" } },
    { type: "sqlite" },
    { type: "console", consoleProvider: "victorialogs" },
    { target: { host: "" } },
    { target: { port: 0 } },
    { target: { port: 65536 } },
    { target: { port: "3306" } },
    { target: { username: "" } },
    { target: { database: "" } },
    { target: { password: null } },
    { target: { unexpected: "secret-value" } },
    { target: { options: "charset=latin1" } },
    { target: { options: ["latin1"] } },
    { target: { options: null } },
  ])("rejects invalid structured targets: %j", (override) => {
    const value = {
      servers: { nas: { url: "http://blocky:4000" } },
      logSources: {
        home: {
          type: override.type ?? "mysql",
          ...(override.consoleProvider
            ? { consoleProvider: override.consoleProvider }
            : {}),
          target: {
            host: "db",
            username: "blocky",
            password: "secret-value",
            database: "blocky",
            ...override.target,
          },
        },
      },
    };
    expect(() => parseConfigurationYaml(JSON.stringify(value))).toThrow(
      /^Invalid Blocky UI configuration at: logSources.home/,
    );
  });
});

it("preserves arbitrary native options and nested YAML values", () => {
  const config = parseConfigurationYaml(`
servers:
  nas: {url: 'http://blocky:4000'}
logSources:
  home:
    type: mysql
    target:
      host: db
      username: blocky
      password: test-only
      database: blocky
      options:
        futureOption: null
        connectTimeout: 15000
        ssl:
          rejectUnauthorized: true
          ca: [first-certificate, second-certificate]
`);
  expect(config.logSources.home?.target).toMatchObject({
    options: {
      futureOption: null,
      connectTimeout: 15000,
      ssl: {
        rejectUnauthorized: true,
        ca: ["first-certificate", "second-certificate"],
      },
    },
  });
});

it.each(["postgresql", "timescale"])(
  "explains the IPv6 limitation for %s without exposing credentials",
  (type) => {
    expect(() =>
      parseConfigurationYaml(`
servers:
  nas:
    url: http://blocky:4000
    headers: {Authorization: private-token}
logSources:
  home:
    type: ${type}
    target:
      host: "2001:db8::1"
      username: blocky
      password: private-password
      database: blocky
`),
    ).toThrow(
      new Error(
        "Invalid Blocky UI configuration at: logSources.home.target.host: Due to upstream driver limitations, IPv6 addresses are not supported here. Use a hostname or IPv4 address.",
      ),
    );
  },
);

it("keeps generic validation errors limited to field paths", () => {
  expect(() =>
    parseConfigurationYaml(`
servers:
  nas:
    url: postgres://user:private-password@database/blocky
    headers: {Authorization: private-token}
`),
  ).toThrow(new Error("Invalid Blocky UI configuration at: servers.nas.url"));
});
