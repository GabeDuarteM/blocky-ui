export type MetricType = "counter" | "gauge" | "histogram" | "summary";

export interface MetricLabels {
  [key: string]: string;
}

export interface MetricSample {
  labels: MetricLabels;
  value: number;
}

export interface MetricFamily {
  name: string;
  help: string;
  type: MetricType;
  samples: MetricSample[];
}

export interface ParsedMetrics {
  metrics: Map<string, MetricFamily>;
}

export interface BlockyMetrics {
  queryTotal: number;
  blocked: number;
  cacheHits: number;
  cacheMisses: number;
  cacheEntries: number;
  errors: number;
  denylistEntries: Array<{ group: string; count: number }>;
  allowlistEntries: Array<{ group: string; count: number }>;
  buildInfo: { version: string; buildTime: string } | null;
  blockingEnabled: boolean | null;
}
