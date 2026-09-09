import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DemoLogProvider } from "~/server/logs/demo-provider";

const { getConfiguration, initializeLogSource } = vi.hoisted(() => ({
  getConfiguration: vi.fn(),
  initializeLogSource: vi.fn(),
}));

vi.mock("~/env", () => ({ env: { DEMO_MODE: false } }));
vi.mock("~/server/config", () => ({ getConfiguration }));
vi.mock("~/server/logs/factory", () => ({ initializeLogSource }));

beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();

  getConfiguration.mockResolvedValue({
    servers: {
      main: { url: "http://blocky:4000", logs: { source: "history" } },
    },
    logSources: { history: { type: "csv", target: "/logs" } },
  });
  initializeLogSource.mockResolvedValue(new DemoLogProvider());
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("log coordinator lifetime", () => {
  it("shares providers between concurrent requests without reloading", async () => {
    const { getLogCoordinator } = await import("~/server/logs");
    const [first, second] = await Promise.all([
      getLogCoordinator(),
      getLogCoordinator(),
    ]);

    await Promise.all([first.count(["main"], {}), second.count(["main"], {})]);

    expect(first).toBe(second);
    expect(getConfiguration).toHaveBeenCalledTimes(1);
    expect(initializeLogSource).toHaveBeenCalledTimes(1);
  });

  it("replaces providers when their implementation is reloaded", async () => {
    const firstModule = await import("~/server/logs");
    const first = await firstModule.getLogCoordinator();

    await first.count(["main"], {});
    vi.resetModules();

    const reloadedModule = await import("~/server/logs");
    const reloaded = await reloadedModule.getLogCoordinator();

    await reloaded.count(["main"], {});

    expect(reloaded).not.toBe(first);
    expect(getConfiguration).toHaveBeenCalledTimes(2);
    expect(initializeLogSource).toHaveBeenCalledTimes(2);
  });
});
