import { type RouterOutputs } from "~/trpc/react";

type StatisticsResult = RouterOutputs["servers"]["statistics"][number];

export function aggregateStatistics(results: StatisticsResult[]) {
  const available = results.flatMap((result) =>
    result.success ? [result.data] : [],
  );
  if (!available.length) {
    return null;
  }
  const totals = available.reduce(
    (total, { summary, overview, answered }) => ({
      queries: total.queries + summary.queries,
      blocked: total.blocked + summary.blocked,
      dropped: total.dropped + summary.dropped,
      errors: total.errors + summary.errors,
      cached: total.cached + summary.cached,
      forwarded: total.forwarded + summary.forwarded,
      duration: total.duration + summary.avgResponseMs * answered,
      entries: total.entries + overview.cacheEntries,
      answered: total.answered + answered,
    }),
    {
      answered: 0,
      queries: 0,
      blocked: 0,
      dropped: 0,
      errors: 0,
      cached: 0,
      forwarded: 0,
      duration: 0,
      entries: 0,
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
