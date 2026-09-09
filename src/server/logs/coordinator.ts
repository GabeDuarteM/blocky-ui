import { type Configuration } from "~/server/config/schema";
import { type TimeRange } from "~/lib/constants";
import { createLogSources } from "~/server/logs/sources";
import { createResultCache } from "~/server/logs/result-cache";
import { mapConcurrent } from "~/server/utils/map-concurrent";
import { MAX_PREFIX_ROWS, mergePage } from "~/server/logs/merge-page";
import { createRankedResults } from "~/server/logs/ranked-results";
import {
  type LogProvider,
  type QueryLogFilters,
  type QueryLogsOptions,
} from "~/server/logs/types";

type RankedEntry = { name: string; count: number; blocked: number };

function rank(groups: RankedEntry[][]) {
  const merged = new Map<string, RankedEntry>();
  for (const group of groups) {
    for (const entry of group) {
      const existing = merged.get(entry.name);
      merged.set(entry.name, {
        name: entry.name,
        count: entry.count + (existing?.count ?? 0),
        blocked: entry.blocked + (existing?.blocked ?? 0),
      });
    }
  }
  const items = [...merged.values()];
  const total = items.reduce((sum, item) => sum + item.count, 0);
  return items
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
    .map((item) => ({
      ...item,
      percentage: total ? (item.count / total) * 100 : 0,
    }));
}

export function createLogCoordinator(
  configuration: Configuration,
  initialize?: Parameters<typeof createLogSources>[1],
) {
  const sources = createLogSources(configuration, initialize);
  const counts = createResultCache<number>({ ttlMs: 30_000, maxEntries: 100 });
  const rankings = createResultCache<{
    results: Awaited<ReturnType<typeof createRankedResults>>;
    diagnostics: { sourceId: string; message: string }[];
  }>({
    ttlMs: 30_000,
    maxEntries: 20,
    maxWeight: 32 * 1024 * 1024,
    weightOf: ({ results }) => results.bytes,
    shouldCache: ({ diagnostics }) => diagnostics.length === 0,
  });
  const charts = createResultCache<
    Awaited<ReturnType<LogProvider["getQueriesOverTime"]>>
  >({
    ttlMs: 30_000,
    maxEntries: 40,
  });

  async function run<T>(
    ids: string[],
    read: (
      source: ReturnType<typeof sources.select>[number],
      provider: LogProvider,
    ) => Promise<T>,
  ) {
    const results = await mapConcurrent(
      sources.select(ids),
      4,
      async (source) => {
        try {
          return {
            success: true,
            value: await read(source, await source.provider()),
          } as const;
        } catch {
          return {
            success: false,
            sourceId: source.id,
            message: "Unable to read this log source.",
          } as const;
        }
      },
    );
    return {
      values: results.flatMap((result) =>
        result.success ? [result.value] : [],
      ),
      diagnostics: results.flatMap((result) =>
        result.success
          ? []
          : [
              {
                sourceId: result.sourceId,
                message: result.message,
              },
            ],
      ),
    };
  }

  async function ranking(
    ids: string[],
    options: {
      type: "domains" | "clients";
      range: TimeRange;
      filter: "all" | "blocked";
    },
  ) {
    const scope = sources
      .select(ids)
      .map((source) => [source.id, source.scope]);
    const key = JSON.stringify([
      scope,
      options.type,
      options.range,
      options.filter,
    ]);
    return rankings.get(key, async () => {
      const result = await run(ids, async (source, provider) => {
        const scoped = {
          ...source.scope,
          range: options.range,
          filter: options.filter,
          offset: 0,
        };

        if (options.type === "domains") {
          return (await provider.getTopDomains(scoped)).items.map((item) => ({
            name: item.domain,
            count: item.count,
            blocked: item.blocked,
          }));
        }

        return (await provider.getTopClients(scoped)).items.map((item) => ({
          name: item.client,
          count: item.total,
          blocked: item.blocked,
        }));
      });

      return {
        results: await createRankedResults(rank(result.values)),
        diagnostics: result.diagnostics,
      };
    });
  }

  return {
    async rows(ids: string[], options: QueryLogsOptions) {
      const snapshot =
        options.offset > MAX_PREFIX_ROWS && sources.select(ids).length > 1;
      const result = await run(ids, async (source, provider) => ({
        source,
        provider,
        maxId: snapshot ? await provider.getQueryLogSnapshot?.() : undefined,
      }));
      const failed = new Set<string>();

      for (;;) {
        const previousFailures = failed.size;
        const readers = result.values
          .filter(({ source }) => !failed.has(source.id))
          .map(({ source, provider, maxId }) => {
            const scoped = { ...options, ...source.scope, maxId };
            const countSince = provider.getQueryLogCountSince?.bind(provider);

            async function read<T>(operation: () => Promise<T>, fallback: T) {
              if (failed.has(source.id)) {
                return fallback;
              }

              try {
                return await operation();
              } catch {
                if (!failed.has(source.id)) {
                  failed.add(source.id);
                  result.diagnostics.push({
                    sourceId: source.id,
                    message: "Unable to read this log source.",
                  });
                }

                return fallback;
              }
            }

            return {
              countBefore: countSince
                ? (pivot: ReturnType<typeof source.identify>) =>
                    read(
                      () =>
                        countSince(
                          scoped,
                          new Date(
                            new Date(pivot.requestTs ?? 0).getTime() +
                              (source.id.localeCompare(pivot.sourceId) < 0
                                ? 0
                                : 1),
                          ),
                        ),
                      0,
                    )
                : undefined,
              count: () => read(() => provider.getQueryLogCount(scoped), 0),
              read: (offset: number, limit: number) =>
                read(
                  async () =>
                    (
                      await provider.getQueryLogRows({
                        ...scoped,
                        offset,
                        limit,
                      })
                    ).map(source.identify),
                  [],
                ),
            };
          });
        const items = await mergePage(
          readers,
          options,
          (a, b) =>
            new Date(b.requestTs ?? 0).getTime() -
              new Date(a.requestTs ?? 0).getTime() ||
            a.sourceId.localeCompare(b.sourceId),
        );

        if (failed.size === previousFailures) {
          return { items, diagnostics: result.diagnostics };
        }
      }
    },

    async count(ids: string[], filters: QueryLogFilters) {
      const result = await run(ids, (source, provider) => {
        const options = {
          ...source.scope,
          search: filters.search,
          client: filters.client,
          questionType: filters.questionType,
          responseType: filters.responseType,
        };
        return counts.get(JSON.stringify([source.id, options]), () =>
          provider.getQueryLogCount(options),
        );
      });
      return {
        totalCount: result.values.reduce((sum, count) => sum + count, 0),
        diagnostics: result.diagnostics,
      };
    },

    async queriesOverTime(
      ids: string[],
      options: Parameters<LogProvider["getQueriesOverTime"]>[0],
    ) {
      const result = await run(ids, (source, provider) => {
        const scoped = { ...options, ...source.scope };
        return charts.get(JSON.stringify([source.id, scoped]), () =>
          provider.getQueriesOverTime(scoped),
        );
      });
      const buckets = new Map<
        string,
        { time: string; total: number; blocked: number; cached: number }
      >();
      for (const rows of result.values) {
        for (const row of rows) {
          const previous = buckets.get(row.time);
          buckets.set(row.time, {
            time: row.time,
            total: row.total + (previous?.total ?? 0),
            blocked: row.blocked + (previous?.blocked ?? 0),
            cached: row.cached + (previous?.cached ?? 0),
          });
        }
      }
      return {
        items: [...buckets.values()].sort((a, b) =>
          a.time.localeCompare(b.time),
        ),
        diagnostics: result.diagnostics,
      };
    },

    async topList(
      ids: string[],
      options: Parameters<typeof ranking>[1] & {
        offset: number;
        limit: number;
      },
    ) {
      const result = await ranking(ids, options);

      return {
        items: await result.results.page(options.offset, options.limit),
        totalCount: result.results.totalCount,
        diagnostics: result.diagnostics,
      };
    },

    async search(
      ids: string[],
      options: {
        type: "domains" | "clients";
        range: TimeRange;
        query: string;
        limit: number;
      },
    ) {
      const result = await ranking(ids, {
        type: options.type,
        range: options.range,
        filter: "all",
      });
      return {
        items: await result.results.search(options.query, options.limit),
        diagnostics: result.diagnostics,
      };
    },

    async queryTypes(ids: string[], range: TimeRange) {
      const result = await run(ids, async (source, provider) =>
        (await provider.getQueryTypesBreakdown(range, source.scope)).map(
          (item) => ({
            name: item.type,
            count: item.count,
            blocked: 0,
          }),
        ),
      );
      return {
        items: rank(result.values).map((item) => ({
          type: item.name,
          count: item.count,
          percentage: item.percentage,
        })),
        diagnostics: result.diagnostics,
      };
    },
  };
}
