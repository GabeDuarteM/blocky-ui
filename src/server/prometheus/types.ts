export type MetricType =
  | "counter"
  | "gauge"
  | "histogram"
  | "summary"
  | "untyped";

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
  denylistEntries: Array<{ group: string; count: number }>;
}
