import { describe, expect, it } from "vitest";
import {
  DEFAULT_DEMO_CONFIGURATION,
  DEMO_CONFIGURATION_HEADER,
  getDemoConfiguration,
  getDemoConfigurationFromHeaders,
  serializeDemoConfiguration,
  type DemoConfiguration,
} from "~/demo/config";

const NO_SERVICES: DemoConfiguration = {
  services: {
    blockyApi: false,
    statistics: false,
    queryLogs: false,
  },
};

const API_AND_LOGS: DemoConfiguration = {
  services: {
    blockyApi: true,
    statistics: false,
    queryLogs: true,
  },
};

describe("demo configuration", () => {
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
      services: {
        blockyApi: false,
        statistics: true,
        queryLogs: true,
      },
    });
  });
});
