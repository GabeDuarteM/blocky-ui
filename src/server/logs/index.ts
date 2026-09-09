import { type LogProvider } from "~/server/logs/types";
import { env } from "~/env";
import { getConfiguration } from "~/server/config";
import { createLogCoordinator } from "~/server/logs/coordinator";
import { DemoLogProvider } from "~/server/logs/demo-provider";

let coordinator: Promise<ReturnType<typeof createLogCoordinator>> | undefined;

export function getLogCoordinator() {
  coordinator ??= getConfiguration().then((configuration) =>
    createLogCoordinator(
      configuration,
      env.DEMO_MODE ? async () => new DemoLogProvider() : undefined,
    ),
  );

  return coordinator;
}

let legacyProvider: Promise<LogProvider | undefined> | undefined;

export function createLogProvider() {
  legacyProvider ??= getConfiguration().then(async (configuration) => {
    if (env.DEMO_MODE) {
      return new DemoLogProvider();
    }

    const server = Object.values(configuration.servers)[0];
    const source = server?.logs && configuration.logSources[server.logs.source];

    if (!source) {
      return undefined;
    }

    const { initializeLogSource } = await import("~/server/logs/factory");
    return initializeLogSource(source);
  });

  return legacyProvider;
}
