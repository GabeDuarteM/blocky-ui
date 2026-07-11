export const DEMO_SETUP_HEADER = "x-blocky-demo-setup";

export const DEMO_SETUPS = [
  {
    id: "complete",
    label: "Complete setup",
    description: "Blocky API, Prometheus, and query logs",
    services: {
      blockyApi: true,
      prometheus: true,
      queryLogs: true,
    },
  },
  {
    id: "without-logs",
    label: "Without query logs",
    description: "Blocky API and Prometheus only",
    services: {
      blockyApi: true,
      prometheus: true,
      queryLogs: false,
    },
  },
  {
    id: "api-only",
    label: "API only",
    description: "No Prometheus or query log provider",
    services: {
      blockyApi: true,
      prometheus: false,
      queryLogs: false,
    },
  },
  {
    id: "offline",
    label: "Blocky offline",
    description: "Simulate an unreachable Blocky instance",
    services: {
      blockyApi: false,
      prometheus: false,
      queryLogs: false,
    },
  },
] as const;

export type DemoSetup = (typeof DEMO_SETUPS)[number];
export type DemoSetupId = DemoSetup["id"];
export type DemoService = keyof DemoSetup["services"];

export const DEFAULT_DEMO_SETUP = DEMO_SETUPS[0];

export function getDemoSetup(value: string | null | undefined): DemoSetup {
  return DEMO_SETUPS.find((setup) => setup.id === value) ?? DEFAULT_DEMO_SETUP;
}

export function getDemoSetupFromHeaders(headers: Headers): DemoSetup {
  return getDemoSetup(headers.get(DEMO_SETUP_HEADER));
}
