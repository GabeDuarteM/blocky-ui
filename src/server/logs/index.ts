import { getConfiguration } from "~/server/config";
import { createLogCoordinator } from "~/server/logs/coordinator";
import { DemoLogProvider } from "~/server/logs/demo-provider";

let coordinator: Promise<ReturnType<typeof createLogCoordinator>> | undefined;

export function getLogCoordinator() {
  coordinator ??= getConfiguration().then((configuration) =>
    createLogCoordinator(
      configuration,
      configuration.demoMode ? async () => new DemoLogProvider() : undefined,
    ),
  );

  return coordinator;
}
