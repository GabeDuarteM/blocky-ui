import { serverSummaries } from "~/server/config/servers";
import { mapConcurrent } from "~/server/utils/map-concurrent";
import ky, { HTTPError, TimeoutError, type KyInstance } from "ky";
import { ZodError } from "zod";
import { type Configuration } from "~/server/config/schema";

function describeFailure(error: unknown) {
  if (error instanceof TimeoutError) {
    return {
      kind: "timeout",
      message: "The server did not respond in time.",
    } as const;
  }
  if (error instanceof HTTPError) {
    return {
      kind: "http",
      message: `The server returned HTTP ${error.response.status}.`,
      status: error.response.status,
    } as const;
  }
  if (error instanceof ZodError) {
    return {
      kind: "response",
      message: "The server returned an unsupported response.",
    } as const;
  }
  return {
    kind: "connection",
    message: "Unable to reach the server.",
  } as const;
}

type ServerResult<T> = { serverId: string } & (
  | { success: true; data: T }
  | { success: false; error: ReturnType<typeof describeFailure> }
);

export function createBlockyServers(configuration: Configuration) {
  const connections = new Map(
    Object.entries(configuration.servers).map(([id, server]) => [
      id,
      {
        api: ky.create({
          baseUrl: server.url,
          headers: server.headers,
          timeout: 5000,
          retry: 0,
        }),
      },
    ]),
  );

  return {
    list() {
      return serverSummaries(configuration);
    },
    async run<T>(
      ids: string[],
      request: (client: KyInstance) => Promise<T>,
    ): Promise<ServerResult<T>[]> {
      if (!ids.length || ids.some((id) => !connections.has(id))) {
        throw new Error("Select configured servers before issuing a request.");
      }
      const selected = [...new Set(ids)].map((id) => {
        const server = connections.get(id);
        if (!server) {
          throw new Error("Unknown server");
        }
        return { id, api: server.api };
      });
      return mapConcurrent(
        selected,
        4,
        async (server): Promise<ServerResult<T>> => {
          try {
            return {
              serverId: server.id,
              success: true,
              data: await request(server.api),
            };
          } catch (error) {
            return {
              serverId: server.id,
              success: false,
              error: describeFailure(error),
            };
          }
        },
      );
    },
  };
}
