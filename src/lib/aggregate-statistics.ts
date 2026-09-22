import type { RouterOutputs } from "~/trpc/react";

type StatisticsResult = RouterOutputs["servers"]["statistics"][number];

export function aggregateStatisticsTraffic(results: StatisticsResult[]) {
  const available = results.flatMap((result) =>
    result.success ? [result.data] : [],
  );
  if (!available.length) {
    return null;
  }

  const buckets = new Map<
    string,
    (typeof available)[number]["queriesOverTime"][number]
  >();
  for (const { queriesOverTime } of available) {
    for (const point of queriesOverTime) {
      const existing = buckets.get(point.time);
      if (existing) {
        existing.total += point.total;
        existing.blocked += point.blocked;
      } else {
        buckets.set(point.time, { ...point });
      }
    }
  }
  const points = [...buckets.values()].sort((a, b) =>
    a.time.localeCompare(b.time),
  );
  const [first] = points;
  const last = points.at(-1);
  if (!(first && last)) {
    return [];
  }

  const traffic: typeof points = [];
  const end = Date.parse(last.time);
  for (let hour = Date.parse(first.time); hour <= end; hour += 3_600_000) {
    const time = new Date(hour).toISOString();
    traffic.push(buckets.get(time) ?? { time, total: 0, blocked: 0 });
  }
  return traffic;
}

export function aggregateStatistics(results: StatisticsResult[]) {
  const available = results.flatMap((result) =>
    result.success ? [result.data] : [],
  );
  if (!available.length) {
    return null;
  }
  const totals = available.reduce(
    (total, { summary, overview, answered }) => ({
      answered: total.answered + answered,
      blocked: total.blocked + summary.blocked,
      cached: total.cached + summary.cached,
      dropped: total.dropped + summary.dropped,
      duration: total.duration + summary.avgResponseMs * answered,
      entries: total.entries + overview.cacheEntries,
      errors: total.errors + summary.errors,
      forwarded: total.forwarded + summary.forwarded,
      queries: total.queries + summary.queries,
    }),
    {
      answered: 0,
      blocked: 0,
      cached: 0,
      dropped: 0,
      duration: 0,
      entries: 0,
      errors: 0,
      forwarded: 0,
      queries: 0,
    },
  );
  const lookups = totals.cached + totals.forwarded;
  return {
    totalQueries: totals.queries,
    blocked: totals.blocked,
    dropped: totals.dropped,
    errors: totals.errors,
    blockedPercentage: totals.queries
      ? (totals.blocked / totals.queries) * 100
      : 0,
    cacheHitRate: lookups ? (totals.cached / lookups) * 100 : 0,
    avgResponseMs: totals.answered
      ? Math.round(totals.duration / totals.answered)
      : 0,
    cacheEntries: totals.entries,
  };
}
