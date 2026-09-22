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
import { executeCommand, readBlockingStatus } from "~/server/blocky/commands";
import { createBlockyServers } from "~/server/blocky/servers";
import { getDemoScenario } from "~/server/demo";

const servers = createBlockyServers(getDemoScenario(2).configuration);
const ids = ["default", "demo-2"];

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterAll(() => server.close());
afterEach(() => vi.restoreAllMocks());
beforeEach(async () => {
  const results = await servers.run(ids, (client) =>
    executeCommand(client, { action: "enable" }),
  );
  if (results.some((result) => !result.success)) {
    throw new Error("Cannot enable demo servers for the test");
  }
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
    // biome-ignore lint/performance/noAwaitInLoops: Each read must finish before advancing the shared mock clock.
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
