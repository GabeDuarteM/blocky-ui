export const DEMO_SERVER_ID_HEADER = "x-blocky-demo-server";
export const DEMO_SERVER_COUNT_HEADER = "x-blocky-demo-server-count";
export const DEMO_SERVER_COUNTS = [1, 2, 3, 5, 10] as const;
export type DemoServerCount = (typeof DEMO_SERVER_COUNTS)[number];

export function parseDemoServerCount(value: string | null): DemoServerCount {
  return DEMO_SERVER_COUNTS.find((count) => String(count) === value) ?? 1;
}

export function demoServers(count: DemoServerCount) {
  return Array.from({ length: count }, (_, index) => ({
    id: index === 0 ? "default" : `demo-${index + 1}`,
    name: ["Home", "Office", "Backup"][index] ?? `Server ${index + 1}`,
    hasLogs: true,
    hasMappedLogs: false,
  }));
}

export const DEMO_CONFIGURATION_HEADER = "x-blocky-demo-services";

export const DEMO_SERVICES = [
  {
    id: "blockyApi",
    label: "Blocky API",
    description: "Status, controls, and query tool",
  },
  {
    id: "statistics",
    label: "Statistics API",
    description: "Overview statistics and fallback top lists",
  },
  {
    id: "queryLogs",
    label: "Query logs",
    description: "Charts and query history",
  },
] as const;

export type DemoService = (typeof DEMO_SERVICES)[number]["id"];

export type DemoConfiguration = {
  serverCount: DemoServerCount;
  services: Record<DemoService, boolean>;
};

export const DEFAULT_DEMO_CONFIGURATION: DemoConfiguration = {
  serverCount: 1,
  services: {
    blockyApi: true,
    statistics: true,
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
  return {
    ...getDemoConfiguration(headers.get(DEMO_CONFIGURATION_HEADER)),
    serverCount: parseDemoServerCount(headers.get(DEMO_SERVER_COUNT_HEADER)),
  };
}

function createDemoConfiguration(
  enabledServices: ReadonlySet<string>,
): DemoConfiguration {
  return {
    serverCount: 1,
    services: {
      blockyApi: enabledServices.has("blockyApi"),
      statistics: enabledServices.has("statistics"),
      queryLogs: enabledServices.has("queryLogs"),
    },
  };
}
