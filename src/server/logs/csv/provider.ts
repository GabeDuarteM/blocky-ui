import type { TimeRange } from "~/lib/constants";
import {
  aggregateQueriesOverTime,
  getTimeRangeConfig,
} from "~/server/logs/aggregation-utils";
import { listCsvFiles } from "~/server/logs/csv/files";
import { createLogPage } from "~/server/logs/csv/page";
import {
  addCounts,
  type Counts,
  createCsvReader,
  type Group,
} from "~/server/logs/csv/reader";
import { readQueryLogPage } from "~/server/logs/query-page";
import type {
  LogProvider,
  LogScope,
  QueryLogFilters,
  QueryLogsOptions,
} from "~/server/logs/types";

type RankingOptions = Parameters<LogProvider["getTopDomains"]>[0];

export class CsvLogProvider implements LogProvider {
  private readonly reader = createCsvReader();

  private readonly options: { directory: string; perClient?: boolean };

  constructor(options: { directory: string; perClient?: boolean }) {
    this.options = options;
  }

  private files(since?: number, until?: number) {
    return listCsvFiles(
      this.options.directory,
      this.options.perClient ?? false,
      since,
      until,
    );
  }

  getQueryLogs(options: QueryLogsOptions) {
    return readQueryLogPage(this, options);
  }

  async getQueryLogRows(options: QueryLogsOptions) {
    if (options.limit === 0) {
      return [];
    }
    const limit = options.offset + options.limit;
    const page = createLogPage(limit);
    const files = (await this.files()).sort(
      (a, b) =>
        (b.day?.end ?? Number.POSITIVE_INFINITY) -
          (a.day?.end ?? Number.POSITIVE_INFINITY) ||
        a.path.localeCompare(b.path),
    );
    for (const file of files) {
      if (file.day && page.canSkipBefore(file.day.end)) {
        break;
      }
      // biome-ignore lint/performance/noAwaitInLoops: Finish this page before deciding whether older files can be skipped.
      const result = await this.reader.page(
        file,
        options,
        Math.max(256, limit),
      );
      for (const entry of result.items) {
        page.add(entry);
      }
    }
    return page.result().items.slice(options.offset, limit);
  }

  async getQueryLogCount(filters: QueryLogFilters) {
    let count = 0;
    for (const file of await this.files()) {
      // biome-ignore lint/performance/noAwaitInLoops: Scan one file at a time to bound memory use across retained history.
      count += await this.reader.count(file, filters);
    }
    return count;
  }

  private async groups(
    group: Group,
    range: TimeRange,
    filters: QueryLogFilters = {},
    until = Date.now(),
  ) {
    const { startTime, interval } = getTimeRangeConfig(range, until);
    const since = startTime.getTime();
    const merged = new Map<string, Counts>();
    for (const file of await this.files(since, until)) {
      // biome-ignore lint/performance/noAwaitInLoops: Merge each file before loading the next summary to bound memory use.
      const groups = await this.reader.groups(file, {
        group,
        since,
        until,
        interval,
        filters,
      });
      for (const [name, value] of groups) {
        const count = merged.get(name) ?? { total: 0, blocked: 0, cached: 0 };
        addCounts(count, value);
        merged.set(name, count);
      }
    }
    return merged;
  }

  async getQueriesOverTime(
    options: Parameters<LogProvider["getQueriesOverTime"]>[0],
  ) {
    const { range, domain, ...filters } = options;
    const now = Date.now();
    const groups = await this.groups(
      "time",
      range,
      {
        ...filters,
        search: domain,
      },
      now,
    );
    return aggregateQueriesOverTime([], range, now).map((bucket) => ({
      ...bucket,
      ...groups.get(String(Date.parse(bucket.time))),
    }));
  }

  private async ranking(
    group: Exclude<Group, "time">,
    options: RankingOptions,
  ) {
    const groups = await this.groups(group, options.range, {
      ...options,
      responseType: options.filter === "blocked" ? "BLOCKED" : undefined,
    });
    const total = [...groups.values()].reduce(
      (sum, value) => sum + value.total,
      0,
    );
    const items = [...groups].sort(
      ([a, x], [b, y]) => y.total - x.total || a.localeCompare(b),
    );
    return {
      totalCount: items.length,
      items: items
        .slice(
          options.offset,
          options.limit === undefined
            ? undefined
            : options.offset + options.limit,
        )
        .map(([name, counts]) => ({
          name,
          count: counts.total,
          blocked: counts.blocked,
          percentage: total ? (counts.total / total) * 100 : 0,
        })),
    };
  }

  async getTopDomains(options: RankingOptions) {
    const result = await this.ranking("questionName", options);
    return {
      ...result,
      items: result.items.map(({ name, ...item }) => ({
        domain: name,
        ...item,
      })),
    };
  }

  async getTopClients(options: RankingOptions) {
    const result = await this.ranking("clientName", options);
    return {
      ...result,
      items: result.items.map(({ name, count, ...item }) => ({
        client: name,
        total: count,
        ...item,
      })),
    };
  }

  async getQueryTypesBreakdown(range: TimeRange, scope: LogScope = {}) {
    const result = await this.ranking("questionType", {
      ...scope,
      range,
      offset: 0,
      filter: "all",
    });
    return result.items.map(({ name, count, percentage }) => ({
      type: name,
      count,
      percentage,
    }));
  }
}
