import {
  type MetricFamily,
  type MetricLabels,
  type MetricSample,
  type MetricType,
  type ParsedMetrics,
} from "./types";

const VALID_METRIC_TYPES: Set<string> = new Set([
  "counter",
  "gauge",
  "histogram",
  "summary",
  "untyped",
]);

function isValidMetricType(type: string): type is MetricType {
  return VALID_METRIC_TYPES.has(type);
}

function parseLabels(labelStr: string): MetricLabels {
  const labels: MetricLabels = {};
  if (!labelStr) return labels;

  const regex = /(\w+)="([^"\\]*(?:\\.[^"\\]*)*)"/g;
  let match;
  while ((match = regex.exec(labelStr)) !== null) {
    const key = match[1];
    const value = match[2];
    if (key && value !== undefined) {
      labels[key] = value.replace(/\\(.)/g, "$1");
    }
  }
  return labels;
}

function parseSampleLine(line: string): MetricSample | null {
  const match = /^([a-zA-Z_:][a-zA-Z0-9_:]*)(?:\{([^}]*)\})?\s+(.+)$/.exec(
    line,
  );
  if (!match) return null;

  const labelStr = match[2] ?? "";
  const valueStr = match[3];
  if (!valueStr) return null;

  const value = parseFloat(valueStr);
  if (isNaN(value)) return null;

  return {
    labels: parseLabels(labelStr),
    value,
  };
}

export function parsePrometheusText(text: string): ParsedMetrics {
  const metrics = new Map<string, MetricFamily>();
  const lines = text.split("\n");

  let currentMetric: MetricFamily | null = null;

  for (const line of lines) {
    const trimmed = line.trim();

    if (!trimmed || trimmed.startsWith("#")) {
      if (trimmed.startsWith("# HELP ")) {
        const helpMatch = /^# HELP (\S+) (.*)$/.exec(trimmed);
        if (helpMatch) {
          const name = helpMatch[1];
          const help = helpMatch[2];
          if (name && help !== undefined) {
            currentMetric = metrics.get(name) ?? {
              name,
              help,
              type: "gauge",
              samples: [],
            };
            currentMetric.help = help;
            metrics.set(name, currentMetric);
          }
        }
      } else if (trimmed.startsWith("# TYPE ")) {
        const typeMatch = /^# TYPE (\S+) (\S+)$/.exec(trimmed);
        if (typeMatch) {
          const name = typeMatch[1];
          const rawType = typeMatch[2] ?? "";
          const type: MetricType = isValidMetricType(rawType)
            ? rawType
            : "gauge";
          if (name) {
            currentMetric = metrics.get(name) ?? {
              name,
              help: "",
              type,
              samples: [],
            };
            currentMetric.type = type;
            metrics.set(name, currentMetric);
          }
        }
      }
      continue;
    }

    const sample = parseSampleLine(trimmed);
    if (sample) {
      const metricNameMatch = /^([a-zA-Z_:][a-zA-Z0-9_:]*)/.exec(trimmed);
      if (metricNameMatch) {
        let metricName = metricNameMatch[1];
        if (!metricName) continue;

        if (
          metricName.endsWith("_total") ||
          metricName.endsWith("_count") ||
          metricName.endsWith("_sum") ||
          metricName.endsWith("_bucket")
        ) {
          const baseName = metricName.replace(
            /(_total|_count|_sum|_bucket)$/,
            "",
          );
          if (metrics.has(baseName)) {
            metricName = baseName;
          }
        }

        if (!metrics.has(metricName)) {
          metrics.set(metricName, {
            name: metricName,
            help: "",
            type: "gauge",
            samples: [],
          });
        }

        const metric = metrics.get(metricName);
        metric?.samples.push(sample);
      }
    }
  }

  return { metrics };
}

export function getMetricValue(
  metrics: ParsedMetrics,
  name: string,
  labels?: MetricLabels,
): number {
  const metric = metrics.metrics.get(name);
  if (!metric) return 0;

  if (!labels) {
    return metric.samples.reduce((sum, s) => sum + s.value, 0);
  }

  return metric.samples
    .filter((s) => Object.entries(labels).every(([k, v]) => s.labels[k] === v))
    .reduce((sum, s) => sum + s.value, 0);
}

export function getMetricSamples(
  metrics: ParsedMetrics,
  name: string,
): MetricSample[] {
  return metrics.metrics.get(name)?.samples ?? [];
}
