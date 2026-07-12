import { beforeEach, describe, expect, it, vi } from "vitest";
import { DEMO_CONFIGURATION_HEADER } from "~/demo/config";

const mocks = vi.hoisted(() => {
  const logProvider = {};

  return {
    logProvider,
    createLogProvider: vi.fn(async () => logProvider),
  };
});

vi.mock("~/env", () => ({
  env: {
    BLOCKY_API_URL: "http://localhost:4000",
    BLOCKY_REQUEST_HEADERS: undefined,
    DEMO_MODE: true,
  },
}));

vi.mock("~/server/logs", () => ({
  createLogProvider: mocks.createLogProvider,
}));

import { blockyRouter } from "~/server/api/routers/blocky";
import { statsRouter } from "~/server/api/routers/stats";
import { createTRPCContext } from "~/server/api/trpc";

function createHeaders(enabledServices?: string): Headers {
  const headers = new Headers();

  if (enabledServices) {
    headers.set(DEMO_CONFIGURATION_HEADER, enabledServices);
  }

  return headers;
}

describe("demo request configuration", () => {
  beforeEach(() => {
    mocks.createLogProvider.mockClear();
  });

  it.each([
    ["blockyApi", true, false, false],
    ["statistics", false, true, false],
    ["queryLogs", false, false, true],
    ["none", false, false, false],
  ])(
    "enables services independently for %s",
    async (enabledServices, blockyApi, statistics, queryLogs) => {
      const context = await createTRPCContext({
        headers: createHeaders(enabledServices),
      });

      expect(context.isDemoServiceAvailable("blockyApi")).toBe(blockyApi);
      expect(context.isDemoServiceAvailable("statistics")).toBe(statistics);
      expect(context.isDemoServiceAvailable("queryLogs")).toBe(queryLogs);

      if (queryLogs) {
        expect(context.logProvider).toBe(mocks.logProvider);
        expect(mocks.createLogProvider).toHaveBeenCalledOnce();
      } else {
        expect(context.logProvider).toBeUndefined();
        expect(mocks.createLogProvider).not.toHaveBeenCalled();
      }
    },
  );

  it.each([undefined, "invalid"])(
    "enables every service for a missing or invalid header",
    async (enabledServices) => {
      const context = await createTRPCContext({
        headers: createHeaders(enabledServices),
      });

      expect(context.isDemoServiceAvailable("blockyApi")).toBe(true);
      expect(context.isDemoServiceAvailable("statistics")).toBe(true);
      expect(context.isDemoServiceAvailable("queryLogs")).toBe(true);
      expect(context.logProvider).toBe(mocks.logProvider);
    },
  );

  it("returns the real unavailable states when services are disabled", async () => {
    const context = await createTRPCContext({
      headers: createHeaders("none"),
    });
    const blockyCaller = blockyRouter.createCaller(context);
    const statsCaller = statsRouter.createCaller(context);

    await expect(blockyCaller.blockingStatus()).rejects.toMatchObject({
      code: "SERVICE_UNAVAILABLE",
      message:
        "Unable to reach Blocky API at http://localhost:4000. Please check if the API server is running.",
    });
    await expect(statsCaller.snapshot()).resolves.toBeNull();
  });
});
