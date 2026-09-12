import { type Configuration } from "~/server/config/schema";

export function serverSummaries(configuration: Configuration) {
  return Object.entries(configuration.servers).map(([id, server]) => ({
    id,
    name: server.name ?? id,
    hasLogs: Boolean(server.logs),
    hasMappedLogs: Boolean(server.logs?.hostname),
  }));
}
