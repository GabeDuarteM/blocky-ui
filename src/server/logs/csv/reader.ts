import { getTimeRangeConfig } from "~/server/logs/aggregation-utils";
import {
  type CsvFile,
  isMissingFile,
  withCsvScan,
} from "~/server/logs/csv/files";
import { createLogPage } from "~/server/logs/csv/page";
import { createFilterFn, scanEntries } from "~/server/logs/csv/utils";
import { createResultCache } from "~/server/logs/result-cache";
import type { LogEntry, QueryLogFilters } from "~/server/logs/types";

export interface Counts {
  total: number;
  blocked: number;
  cached: number;
}
export type Group = "time" | "questionName" | "clientName" | "questionType";

export function addCounts(target: Counts, value: Counts) {
  target.total += value.total;
  target.blocked += value.blocked;
  target.cached += value.cached;
}

function filterKey(filters: QueryLogFilters) {
  return [
    filters.search?.toLowerCase(),
    filters.domain?.toLowerCase(),
    filters.client?.toLowerCase(),
    filters.questionType,
    filters.responseType,
    [...(filters.excludedHostnames ?? [])].sort(),
  ];
}

async function scan(file: CsvFile, visit: (entry: LogEntry) => void) {
  try {
    await withCsvScan(() => scanEntries(file.path, visit, file.size));
  } catch (error) {
    if (!isMissingFile(error)) {
      throw error;
    }
  }
}

const SUMMARY_INTERVAL = getTimeRangeConfig("1h").interval;

function createSummary() {
  return {
    totalCount: 0,
    groups: {
      time: new Map<string, Counts>(),
      questionName: new Map<string, Counts>(),
      clientName: new Map<string, Counts>(),
      questionType: new Map<string, Counts>(),
    },
  };
}

function addEntry(groups: Map<string, Counts>, key: string, entry: LogEntry) {
  let counts = groups.get(key);
  if (!counts) {
    counts = { total: 0, blocked: 0, cached: 0 };
    // Copy cached keys so field substrings cannot retain entire CSV chunks.
    groups.set(Buffer.from(key).toString(), counts);
  }
  counts.total += 1;
  if (entry.responseType === "BLOCKED") {
    counts.blocked += 1;
  }
  if (entry.responseType === "CACHED") {
    counts.cached += 1;
  }
}

export function createCsvReader() {
  const summaries = createResultCache<ReturnType<typeof createSummary>>({
    ttlMs: Number.POSITIVE_INFINITY,
    maxEntries: 2048,
    maxWeight: 16 * 1024 * 1024,
    weightOf: ({ groups }) =>
      Object.values(groups).reduce(
        (size, group) =>
          size +
          [...group.keys()].reduce(
            (bytes, key) => bytes + key.length * 2 + 128,
            128,
          ),
        128,
      ),
  });
  const pages = createResultCache<
    ReturnType<ReturnType<typeof createLogPage>["result"]>
  >({
    ttlMs: Number.POSITIVE_INFINITY,
    maxEntries: 512,
    maxWeight: 16 * 1024 * 1024,
    weightOf: ({ items }) =>
      items.reduce(
        (size, entry) =>
          size +
          Object.values(entry).reduce<number>(
            (bytes, value) =>
              bytes + (typeof value === "string" ? value.length * 2 : 8),
            192,
          ),
        128,
      ),
  });

  function summary(
    file: CsvFile,
    filters: QueryLogFilters,
    since = Number.NEGATIVE_INFINITY,
    until = Number.POSITIVE_INFINITY,
  ) {
    const key = JSON.stringify([
      file.path,
      file.version,
      since,
      until,
      filterKey(filters),
    ]);
    return summaries.get(key, async () => {
      const result = createSummary();
      const matches = createFilterFn(filters);
      await scan(file, (entry) => {
        if (!matches(entry)) {
          return;
        }
        result.totalCount += 1;
        const time = Date.parse(entry.requestTs ?? "");
        if (!Number.isFinite(time) || time < since || time > until) {
          return;
        }
        addEntry(
          result.groups.time,
          String(Math.floor(time / SUMMARY_INTERVAL) * SUMMARY_INTERVAL),
          entry,
        );
        addEntry(
          result.groups.questionName,
          entry.questionName ?? "unknown",
          entry,
        );
        addEntry(
          result.groups.clientName,
          entry.clientName ?? "unknown",
          entry,
        );
        addEntry(
          result.groups.questionType,
          entry.questionType ?? "unknown",
          entry,
        );
      });
      return result;
    });
  }

  return {
    async count(file: CsvFile, filters: QueryLogFilters) {
      return (await summary(file, filters)).totalCount;
    },
    page(file: CsvFile, filters: QueryLogFilters, limit = 256) {
      const key = JSON.stringify([
        file.path,
        file.version,
        filterKey(filters),
        limit,
      ]);
      return pages.get(key, async () => {
        const page = createLogPage(limit);
        const matches = createFilterFn(filters);
        await scan(file, (entry) => {
          if (matches(entry)) {
            page.add(entry);
          }
        });
        // Copy row strings so cached pages cannot retain entire CSV chunks.
        return structuredClone(page.result());
      });
    },
    async groups(
      file: CsvFile,
      options: {
        group: Group;
        since: number;
        until: number;
        interval: number;
        filters: QueryLogFilters;
      },
    ) {
      const { group, interval, filters } = options;
      const since =
        file.day && options.since <= file.day.start
          ? Number.NEGATIVE_INFINITY
          : options.since;
      const until =
        file.day && options.until >= file.day.end
          ? Number.POSITIVE_INFINITY
          : options.until;
      const result = (await summary(file, filters, since, until)).groups[group];
      if (group !== "time" || interval === SUMMARY_INTERVAL) {
        return result;
      }
      const buckets = new Map<string, Counts>();
      for (const [time, counts] of result) {
        const key = String(Math.floor(Number(time) / interval) * interval);
        const bucket = buckets.get(key) ?? { total: 0, blocked: 0, cached: 0 };
        addCounts(bucket, counts);
        buckets.set(key, bucket);
      }
      return buckets;
    },
  };
}
