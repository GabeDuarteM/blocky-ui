import { normalizeLogTimestamp } from "~/server/logs/timestamp";
import { type Configuration } from "~/server/config/schema";
import {
  type LogEntry,
  type LogProvider,
  type LogScope,
} from "~/server/logs/types";
import { initializeLogSource } from "~/server/logs/factory";

export function createLogSources(
  configuration: Configuration,
  initialize = initializeLogSource,
) {
  const providers = new Map<string, Promise<LogProvider>>();
  const servers = Object.entries(configuration.servers);

  function providerFor(id: string) {
    const source = configuration.logSources[id];
    if (!source) {
      throw new Error("Unknown log source");
    }
    const existing = providers.get(id);
    if (existing) {
      return existing;
    }
    const pending = initialize(source);
    providers.set(id, pending);
    void pending.catch(() => {
      if (providers.get(id) === pending) {
        providers.delete(id);
      }
    });
    return pending;
  }

  return {
    select(serverIds: string[]) {
      const selected = new Set(serverIds);
      if (
        !selected.size ||
        serverIds.some((id) => !Object.hasOwn(configuration.servers, id))
      ) {
        throw new Error("Select configured servers before requesting logs.");
      }
      return Object.keys(configuration.logSources).flatMap((sourceId) => {
        const owners = servers.filter(
          ([, server]) => server.logs?.source === sourceId,
        );
        if (!owners.length) {
          return [];
        }
        const soleOwner = owners.length === 1 ? owners[0] : undefined;
        if (
          soleOwner &&
          !soleOwner[1].logs?.hostname &&
          !selected.has(soleOwner[0])
        ) {
          return [];
        }
        const scope: LogScope = {
          excludedHostnames: owners
            .flatMap(([id, server]) =>
              !selected.has(id) && server.logs?.hostname
                ? [server.logs.hostname]
                : [],
            )
            .sort(),
        };
        return [
          {
            id: sourceId,
            scope,
            provider: () => providerFor(sourceId),
            identify(entry: LogEntry) {
              const matched = owners.filter(
                ([, server]) => server.logs?.hostname === entry.hostname,
              );
              const owner = matched.length === 1 ? matched[0] : undefined;
              const dedicated =
                owners.length === 1 && !owners[0]?.[1].logs?.hostname
                  ? owners[0]
                  : undefined;
              const identified = owner ?? dedicated;
              return {
                ...entry,
                requestTs: normalizeLogTimestamp(entry.requestTs),
                sourceId,
                serverId: identified?.[0] ?? null,
              };
            },
          },
        ];
      });
    },
  };
}
