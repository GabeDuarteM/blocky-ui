import { env } from "~/env";
import {
  demoServers,
  DEMO_SERVER_ID_HEADER,
  type DemoServerCount,
} from "~/demo/config";
import { type Configuration } from "~/server/config/schema";
import { createLogCoordinator } from "~/server/logs/coordinator";
import { DemoLogProvider } from "~/server/logs/demo-provider";

function createDemoScenario(count: DemoServerCount) {
  const servers = demoServers(count);
  const configuration: Configuration = {
    demoMode: true,
    servers: Object.fromEntries(
      servers.map(({ id, name }) => [
        id,
        {
          name,
          url: env.BLOCKY_API_URL,
          headers: { [DEMO_SERVER_ID_HEADER]: id },
          logs: { source: id },
        },
      ]),
    ),
    logSources: Object.fromEntries(
      servers.map(({ id }) => [id, { type: "csv", target: "demo" }]),
    ),
  };

  return {
    configuration,
    logs: createLogCoordinator(
      configuration,
      async () => new DemoLogProvider(),
    ),
  };
}

const scenarios = new Map<
  DemoServerCount,
  ReturnType<typeof createDemoScenario>
>();

export function getDemoScenario(count: DemoServerCount) {
  const existing = scenarios.get(count);

  if (existing) {
    return existing;
  }

  const scenario = createDemoScenario(count);
  scenarios.set(count, scenario);

  return scenario;
}
