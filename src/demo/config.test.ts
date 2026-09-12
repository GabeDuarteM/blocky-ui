import { describe, expect, it } from "vitest";
import {
  DEFAULT_DEMO_CONFIGURATION,
  DEMO_CONFIGURATION_HEADER,
  DEMO_SERVER_COUNT_HEADER,
  DEMO_SERVER_COUNTS,
  getDemoConfiguration,
  getDemoConfigurationFromHeaders,
  serializeDemoConfiguration,
  type DemoConfiguration,
} from "~/demo/config";

const NO_SERVICES: DemoConfiguration = {
  serverCount: 1,
  services: {
    blockyApi: false,
    statistics: false,
    queryLogs: false,
  },
};

const API_AND_LOGS: DemoConfiguration = {
  serverCount: 1,
  services: {
    blockyApi: true,
    statistics: false,
    queryLogs: true,
  },
};

describe("demo configuration", () => {
  it.each(DEMO_SERVER_COUNTS)("reads a server count of %s", (count) => {
    const headers = new Headers({ [DEMO_SERVER_COUNT_HEADER]: String(count) });
    expect(getDemoConfigurationFromHeaders(headers).serverCount).toBe(count);
  });

  it.each(["0", "4", "1000000", "invalid"])(
    "rejects unsupported count %s",
    (count) => {
      const headers = new Headers({ [DEMO_SERVER_COUNT_HEADER]: count });
      expect(getDemoConfigurationFromHeaders(headers).serverCount).toBe(1);
    },
  );

  it.each([
    [DEFAULT_DEMO_CONFIGURATION, "blockyApi,statistics,queryLogs"],
    [API_AND_LOGS, "blockyApi,queryLogs"],
    [NO_SERVICES, "none"],
  ])("serializes enabled services", (configuration, value) => {
    expect(serializeDemoConfiguration(configuration)).toBe(value);
  });

  it.each([
    ["blockyApi,statistics,queryLogs", DEFAULT_DEMO_CONFIGURATION],
    ["blockyApi,queryLogs", API_AND_LOGS],
    ["none", NO_SERVICES],
  ])("parses enabled services", (value, configuration) => {
    expect(getDemoConfiguration(value)).toEqual(configuration);
  });

  it.each([undefined, null, "unknown", "blockyApi,unknown"])(
    "defaults a missing or invalid value to all services",
    (value) => {
      expect(getDemoConfiguration(value)).toBe(DEFAULT_DEMO_CONFIGURATION);
    },
  );

  it("reads enabled services from the request header", () => {
    const headers = new Headers({
      [DEMO_CONFIGURATION_HEADER]: "statistics,queryLogs",
    });

    expect(getDemoConfigurationFromHeaders(headers)).toEqual({
      serverCount: 1,
      services: {
        blockyApi: false,
        statistics: true,
        queryLogs: true,
      },
    });
  });
});
