import { env } from "~/env";
import { parseConfiguration, type Configuration } from "~/server/config/schema";

let configuration: Promise<Configuration> | undefined;

async function loadConfiguration(): Promise<Configuration> {
  const logSource = env.DEMO_MODE
    ? { type: "csv", target: "demo" }
    : env.QUERY_LOG_TYPE
      ? {
          type: env.QUERY_LOG_TYPE,
          target: env.QUERY_LOG_TARGET,
          consoleProvider: env.QUERY_LOG_CONSOLE_PROVIDER,
        }
      : undefined;
  return parseConfiguration({
    servers: {
      default: {
        name: env.INSTANCE_NAME ?? "Blocky",
        url: env.BLOCKY_API_URL,
        headers: env.BLOCKY_REQUEST_HEADERS,
        logs: logSource ? { source: "default" } : undefined,
      },
    },
    logSources: logSource ? { default: logSource } : {},
  });
}

export function getConfiguration(): Promise<Configuration> {
  configuration ??= loadConfiguration();
  return configuration;
}
