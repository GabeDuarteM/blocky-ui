import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  expect,
  it,
  vi,
} from "vitest";

vi.mock("~/env", () => ({
  env: { BLOCKY_API_URL: "http://blocky-demo.test" },
}));

import { server } from "~/mocks/server";
import { getDemoScenario } from "~/server/demo";
import { createBlockyServers } from "~/server/blocky/servers";
import { executeCommand, readBlockingStatus } from "~/server/blocky/commands";

const servers = createBlockyServers(getDemoScenario(2).configuration);
const ids = ["default", "demo-2"];

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterAll(() => server.close());
afterEach(() => vi.restoreAllMocks());
beforeEach(async () => {
  const results = await servers.run(ids, (client) =>
    executeCommand(client, { action: "enable" }),
  );
  expect(results.every((result) => result.success)).toBe(true);
});

it("changes blocking only on the selected demo instance", async () => {
  await servers.run(["default"], (client) =>
    executeCommand(client, { action: "disable", duration: "0" }),
  );

  expect(await servers.run(ids, readBlockingStatus)).toMatchObject([
    { serverId: "default", success: true, data: { enabled: false } },
    { serverId: "demo-2", success: true, data: { enabled: true } },
  ]);
});

it("keeps the pause deadline unchanged across status reads", async () => {
  const now = vi.spyOn(Date, "now").mockReturnValue(1_000_000);

  await servers.run(["default"], (client) =>
    executeCommand(client, { action: "disable", duration: "1m" }),
  );

  for (const elapsed of [10, 20, 60]) {
    now.mockReturnValue(1_000_000 + elapsed * 1000);
    expect(await servers.run(["default"], readBlockingStatus)).toMatchObject([
      {
        success: true,
        data: {
          enabled: elapsed === 60,
          autoEnableInSec: 60 - elapsed,
        },
      },
    ]);
  }
});
