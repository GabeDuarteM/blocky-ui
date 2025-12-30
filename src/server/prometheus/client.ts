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
  const blockedResponses = getMetricValue(parsed, "blocky_response_total", {
    response_type: "BLOCKED",
  });
  const cacheHits = getMetricValue(parsed, "blocky_cache_hits_total");
  const cacheMisses = getMetricValue(parsed, "blocky_cache_misses_total");
  const cacheEntries = getMetricValue(parsed, "blocky_cache_entries");
  const errors = getMetricValue(parsed, "blocky_error_total");

  const denylistSamples = getMetricSamples(
    parsed,
    "blocky_denylist_cache_entries",
  );
  const denylistEntries = denylistSamples.map((s) => ({
    group: s.labels.group ?? "unknown",
    count: s.value,
  }));

  const allowlistSamples = getMetricSamples(
    parsed,
    "blocky_allowlist_cache_entries",
  );
  const allowlistEntries = allowlistSamples.map((s) => ({
    group: s.labels.group ?? "unknown",
    count: s.value,
  }));

  const buildInfoSamples = getMetricSamples(parsed, "blocky_build_info");
  const buildInfo =
    buildInfoSamples.length > 0 && buildInfoSamples[0]
      ? {
          version: buildInfoSamples[0].labels.version ?? "",
          buildTime: buildInfoSamples[0].labels.build_time ?? "",
        }
      : null;

  const blockingEnabledSamples = getMetricSamples(
    parsed,
    "blocky_blocking_enabled",
  );
  const blockingEnabled =
    blockingEnabledSamples.length > 0 && blockingEnabledSamples[0]
      ? blockingEnabledSamples[0].value === 1
      : null;

  return {
    queryTotal,
    blocked: blockedResponses,
    cacheHits,
    cacheMisses,
    cacheEntries,
    errors,
    denylistEntries,
    allowlistEntries,
    buildInfo,
    blockingEnabled,
  };
}
