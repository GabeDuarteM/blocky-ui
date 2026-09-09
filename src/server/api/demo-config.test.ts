import { describe, expect, it, vi } from "vitest";
import { DEMO_CONFIGURATION_HEADER } from "~/demo/config";

vi.mock("~/env", () => ({
  env: {
    BLOCKY_API_URL: "http://localhost:4000",
    BLOCKY_REQUEST_HEADERS: undefined,
    DEMO_MODE: true,
  },
}));

import { serversRouter } from "~/server/api/routers/servers";
import { logsRouter } from "~/server/api/routers/logs";
import { createTRPCContext } from "~/server/api/trpc";

function createHeaders(enabledServices?: string): Headers {
  const headers = new Headers();
  if (enabledServices) {
    headers.set(DEMO_CONFIGURATION_HEADER, enabledServices);
  }
  return headers;
}

describe("demo request configuration", () => {
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
    },
  );

  it("returns unavailable states when services are disabled", async () => {
    const context = await createTRPCContext({ headers: createHeaders("none") });
    const servers = serversRouter.createCaller(context);
    const logs = logsRouter.createCaller(context);
    const scope = { serverIds: ["default"] };
    await expect(servers.blockingStatus(scope)).rejects.toMatchObject({
      code: "SERVICE_UNAVAILABLE",
      message: "Unable to reach the Blocky API.",
    });
    await expect(servers.statistics(scope)).resolves.toEqual([]);
    await expect(logs.rows(scope)).rejects.toMatchObject({
      code: "SERVICE_UNAVAILABLE",
    });
  });
});
