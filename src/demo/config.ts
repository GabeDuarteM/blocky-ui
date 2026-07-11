export const DEMO_CONFIGURATION_HEADER = "x-blocky-demo-services";

export const DEMO_SERVICES = [
  {
    id: "blockyApi",
    label: "Blocky API",
    description: "Status, controls, and query tool",
  },
  {
    id: "prometheus",
    label: "Prometheus",
    description: "Metrics and overview statistics",
  },
  {
    id: "queryLogs",
    label: "Query logs",
    description: "Charts and query history",
  },
] as const;

export type DemoService = (typeof DEMO_SERVICES)[number]["id"];

export type DemoConfiguration = {
  services: Record<DemoService, boolean>;
};

export const DEFAULT_DEMO_CONFIGURATION: DemoConfiguration = {
  services: {
    blockyApi: true,
    prometheus: true,
    queryLogs: true,
  },
};

export function serializeDemoConfiguration(
  configuration: DemoConfiguration,
): string {
  const enabledServices = DEMO_SERVICES.flatMap(({ id }) =>
    configuration.services[id] ? [id] : [],
  );

  return enabledServices.length > 0 ? enabledServices.join(",") : "none";
}

export function getDemoConfiguration(
  value: string | null | undefined,
): DemoConfiguration {
  if (value === null || value === undefined) {
    return DEFAULT_DEMO_CONFIGURATION;
  }

  if (value === "none") {
    return createDemoConfiguration(new Set());
  }

  const serviceIds = value.split(",");
  const knownServices = new Set<string>(
    DEMO_SERVICES.map((service) => service.id),
  );

  if (serviceIds.some((serviceId) => !knownServices.has(serviceId))) {
    return DEFAULT_DEMO_CONFIGURATION;
  }

  return createDemoConfiguration(new Set(serviceIds));
}

export function getDemoConfigurationFromHeaders(
  headers: Headers,
): DemoConfiguration {
  return getDemoConfiguration(headers.get(DEMO_CONFIGURATION_HEADER));
}

function createDemoConfiguration(
  enabledServices: ReadonlySet<string>,
): DemoConfiguration {
  return {
    services: {
      blockyApi: enabledServices.has("blockyApi"),
      prometheus: enabledServices.has("prometheus"),
      queryLogs: enabledServices.has("queryLogs"),
    },
  };
}
