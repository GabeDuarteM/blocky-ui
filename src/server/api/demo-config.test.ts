import { beforeEach, describe, expect, it, vi } from "vitest";
import { DEMO_SETUPS, DEMO_SETUP_HEADER } from "~/demo/config";

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

function createHeaders(setupId?: string): Headers {
  const headers = new Headers();

  if (setupId) {
    headers.set(DEMO_SETUP_HEADER, setupId);
  }

  return headers;
}

describe("demo request configuration", () => {
  beforeEach(() => {
    mocks.createLogProvider.mockClear();
  });

  it.each(DEMO_SETUPS)("applies the $id service policy", async (setup) => {
    const context = await createTRPCContext({
      headers: createHeaders(setup.id),
    });

    expect(context.isDemoServiceAvailable("blockyApi")).toBe(
      setup.services.blockyApi,
    );
    expect(context.isDemoServiceAvailable("prometheus")).toBe(
      setup.services.prometheus,
    );
    expect(context.isDemoServiceAvailable("queryLogs")).toBe(
      setup.services.queryLogs,
    );

    if (setup.services.queryLogs) {
      expect(context.logProvider).toBe(mocks.logProvider);
      expect(mocks.createLogProvider).toHaveBeenCalledOnce();
    } else {
      expect(context.logProvider).toBeUndefined();
      expect(mocks.createLogProvider).not.toHaveBeenCalled();
    }
  });

  it.each([undefined, "invalid"])(
    "uses the complete setup for a missing or invalid header",
    async (setupId) => {
      const context = await createTRPCContext({
        headers: createHeaders(setupId),
      });

      expect(context.isDemoServiceAvailable("blockyApi")).toBe(true);
      expect(context.isDemoServiceAvailable("prometheus")).toBe(true);
      expect(context.isDemoServiceAvailable("queryLogs")).toBe(true);
      expect(context.logProvider).toBe(mocks.logProvider);
    },
  );

  it("returns the real unavailable states for the offline setup", async () => {
    const context = await createTRPCContext({
      headers: createHeaders("offline"),
    });
    const blockyCaller = blockyRouter.createCaller(context);
    const statsCaller = statsRouter.createCaller(context);

    await expect(blockyCaller.blockingStatus()).rejects.toThrow(
      "Unable to reach Blocky API at http://localhost:4000. Please check if the API server is running.",
    );
    await expect(statsCaller.prometheusStatus()).resolves.toEqual({
      available: false,
    });
    await expect(statsCaller.overview()).resolves.toBeNull();
  });
});
