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
