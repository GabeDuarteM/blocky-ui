import { createServer } from "node:http";
import { afterEach, describe, expect, it } from "vitest";
import { parseConfiguration } from "~/server/config/schema";
import { createBlockyServers } from "~/server/blocky/servers";
import { executeCommand, readBlockingStatus } from "~/server/blocky/commands";

const cleanup: Array<() => Promise<void>> = [];
afterEach(async () => {
  for (const close of cleanup.splice(0)) {
    await close();
  }
});

async function fixture(failingServer?: string) {
  const requests: Array<{
    url: string;
    method: string;
    authorization?: string;
  }> = [];
  let active = 0;
  let maximumActive = 0;
  const server = createServer((request, response) => {
    requests.push({
      url: request.url ?? "",
      method: request.method ?? "",
      authorization: request.headers.authorization,
    });
    active++;
    maximumActive = Math.max(active, maximumActive);
    setTimeout(() => {
      active--;
      response.setHeader("Content-Type", "application/json");
      if (failingServer && request.url?.startsWith(`/${failingServer}/`)) {
        response.writeHead(503);
        response.end(JSON.stringify({ error: "private upstream detail" }));
      } else {
        response.end(JSON.stringify({ enabled: true }));
      }
    }, 20);
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  cleanup.push(
    () =>
      new Promise<void>((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
        server.closeAllConnections();
      }),
  );
  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error("Expected a TCP listener");
  }
  const ids = Array.from({ length: 10 }, (_, index) => `server-${index}`);
  const configuration = parseConfiguration({
    servers: Object.fromEntries(
      ids.map((id) => [
        id,
        {
          url: `http://127.0.0.1:${address.port}/${id}/`,
          headers: { Authorization: `Bearer ${id}` },
        },
      ]),
    ),
  });
  return {
    service: createBlockyServers(configuration),
    ids,
    requests,
    getMaximumActive: () => maximumActive,
  };
}

describe("requests to configured Blocky servers", () => {
  it("bounds concurrency, preserves server identity, and retains successes alongside failures", async () => {
    const { service, ids, requests, getMaximumActive } =
      await fixture("server-1");
    const results = await service.run(ids, readBlockingStatus);
    expect(results.map((result) => result.serverId)).toEqual(ids);
    expect(results.filter((result) => result.success)).toHaveLength(9);
    expect(results[1]).toEqual({
      serverId: "server-1",
      success: false,
      error: {
        kind: "http",
        message: "The server returned HTTP 503.",
        status: 503,
      },
    });
    expect(requests).toHaveLength(10);
    expect(getMaximumActive()).toBe(4);
    expect(
      requests.every(
        (request) =>
          request.authorization === `Bearer ${request.url.split("/")[1]}`,
      ),
    ).toBe(true);
    expect(JSON.stringify(service.list())).not.toContain("Bearer");
    expect(JSON.stringify(service.list())).not.toContain("http:");
  });

  it("validates the whole target selection before sending any commands", async () => {
    const { service, requests } = await fixture();
    await expect(
      service.run(["server-0", "unknown"], (client) =>
        executeCommand(client, { action: "enable" }),
      ),
    ).rejects.toThrow("configured servers");
    await expect(service.run([], readBlockingStatus)).rejects.toThrow(
      "configured servers",
    );
    expect(requests).toHaveLength(0);
  });

  it("sends a command once to each selected server with its duration and groups", async () => {
    const { service, requests } = await fixture();
    const results = await service.run(
      ["server-2", "server-2", "server-4"],
      (client) =>
        executeCommand(client, {
          action: "disable",
          duration: "5m",
          groups: "ads,tracking",
        }),
    );
    expect(results).toHaveLength(2);
    expect(requests).toHaveLength(2);
    expect(requests.map((request) => request.url)).toEqual([
      "/server-2/api/blocking/disable?duration=5m&groups=ads%2Ctracking",
      "/server-4/api/blocking/disable?duration=5m&groups=ads%2Ctracking",
    ]);
  });
});
