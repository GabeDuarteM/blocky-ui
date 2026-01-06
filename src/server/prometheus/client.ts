import ky from "ky";

import { env } from "~/env";
import {
  getMetricSamples,
  getMetricValue,
  parsePrometheusText,
} from "./parser";
import { type BlockyMetrics, type ParsedMetrics } from "./types";

function getPrometheusUrl(): string {
  return `${env.BLOCKY_API_URL}${env.PROMETHEUS_PATH}`;
}

export async function fetchPrometheusMetrics(): Promise<ParsedMetrics | null> {
  try {
    const text = await ky.get(getPrometheusUrl(), { timeout: 10000 }).text();
    return parsePrometheusText(text);
  } catch {
    return null;
  }
}

export async function checkPrometheusAvailable(): Promise<boolean> {
  try {
    await ky.head(getPrometheusUrl(), { timeout: 5000 });
    return true;
  } catch {
    return false;
  }
}

export function extractBlockyMetrics(parsed: ParsedMetrics): BlockyMetrics {
  const queryTotal = getMetricValue(parsed, "blocky_query_total");
  const blocked = getMetricValue(parsed, "blocky_response_total", {
    response_type: "BLOCKED",
  });
  const cacheHits = getMetricValue(parsed, "blocky_cache_hits_total");
  const cacheMisses = getMetricValue(parsed, "blocky_cache_misses_total");

  const denylistSamples = getMetricSamples(
    parsed,
    "blocky_denylist_cache_entries",
  );
  const denylistEntries = denylistSamples.map((s) => ({
    group: s.labels.group ?? "unknown",
    count: s.value,
  }));

  return {
    queryTotal,
    blocked,
    cacheHits,
    cacheMisses,
    denylistEntries,
  };
}
