import { readQueryLogPage } from "~/server/logs/query-page";
import ky from "ky";
import { getTimeRangeConfig } from "~/server/logs/aggregation-utils";
import {
  type LogEntry,
  type LogScope,
  type QueryLogFilters,
  type LogProvider,
  type QueriesOverTimeEntry,
  type QueryLogsOptions,
  type QueryLogsResult,
  type QueryTypeEntry,
  type TopClientEntry,
  type TopDomainEntry,
} from "~/server/logs/types";
import { type TimeRange } from "~/lib/constants";

// Base filter that identifies blocky query-log entries in VictoriaLogs.
// blocky sets prefix:"queryLog" on every DNS query log line it emits to stdout,
// which distinguishes them from blocky's startup and operational messages.
const BASE_FILTER = "prefix:queryLog";

function rangeToVlStart(range: TimeRange): string {
  return getTimeRangeConfig(range).startTime.toISOString();
}

function rangeToVlBucket(range: TimeRange): string {
  switch (range) {
    case "1h":
      return "5m";
    case "24h":
      return "1h";
    case "7d":
      return "6h";
    case "30d":
      return "1d";
  }
}

function regexFilter(
  field: "question_name" | "client_names",
  value: string,
): string {
  const pattern = value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return `${field}:~${JSON.stringify(`(?i)${pattern}`)}`;
}

// Normalise a VL timestamp to a consistent key format for bucket lookups.
// VL stats by (_time:Nx) returns "YYYY-MM-DDTHH:MM:SSZ" (no milliseconds).
// Date.toISOString() returns "YYYY-MM-DDTHH:MM:SS.mmmZ". Strip the fractional
// seconds so that generated keys and VL-returned keys can be matched.
function toVlKey(isoStr: string): string {
  return isoStr.replace(/\.\d+Z$/, "Z");
}

// Fill missing time buckets with zero values, matching the behaviour of
// BaseSqlLogProvider.fillTimeBuckets. VL only returns buckets that have at
// least one log entry, so without this charts would show gaps instead of a
// flat zero line during quiet periods.
function fillVlTimeBuckets(
  totalMap: Map<string, number>,
  blockedMap: Map<string, number>,
  cachedMap: Map<string, number>,
  startTime: Date,
  interval: number,
): QueriesOverTimeEntry[] {
  const results: QueriesOverTimeEntry[] = [];
  const now = Date.now();
  // Align to bucket boundary (same logic VL uses for UTC-aligned buckets)
  let current = Math.floor(startTime.getTime() / interval) * interval;

  while (current <= now) {
    const key = toVlKey(new Date(current).toISOString());
    results.push({
      time: new Date(current).toISOString(),
      total: totalMap.get(key) ?? 0,
      blocked: blockedMap.get(key) ?? 0,
      cached: cachedMap.get(key) ?? 0,
    });
    current += interval;
  }

  return results;
}

export class VictoriaLogsProvider implements LogProvider {
  private readonly client: typeof ky;

  constructor({ url }: { url: string }) {
    this.client = ky.create({
      baseUrl: url.replace(/\/$/, ""),
      timeout: 30_000,
    });
  }

  private async queryRaw(
    logql: string,
    params: { start?: string; limit?: number } = {},
  ): Promise<Record<string, string>[]> {
    try {
      const searchParams = new URLSearchParams({ query: logql });
      if (params.start) {
        searchParams.set("start", params.start);
      }
      if (params.limit !== undefined)
        searchParams.set("limit", String(params.limit));

      const text = await this.client
        .get("select/logsql/query", { searchParams })
        .text();

      const lines = text.trim().split("\n").filter(Boolean);
      return lines.map((line) => {
        try {
          return JSON.parse(line) as Record<string, string>;
        } catch {
          throw new Error(
            `VictoriaLogs: failed to parse response line (${line.length} chars)`,
          );
        }
      });
    } catch (error) {
      throw new Error("VictoriaLogs: queryRaw failed", { cause: error });
    }
  }

  private mapEntry(raw: Record<string, string>): LogEntry {
    return {
      requestTs: raw._time ?? null,
      clientIp: raw.client_ip || null,
      clientName: raw.client_names || null,
      durationMs: raw.duration_ms ? Number(raw.duration_ms) : null,
      reason: raw.response_reason || null,
      questionName: raw.question_name || null,
      answer: raw.answer || null,
      responseCode: raw.response_code || null,
      responseType: raw.response_type || null,
      questionType: raw.question_type || null,
      hostname: raw.instance || null,
      effectiveTldp: null,
      id: null,
    };
  }

  private scopeQuery(scope: LogScope): string {
    return [
      BASE_FILTER,
      ...(scope.excludedHostnames ?? []).map(
        (hostname) => `NOT instance:exact(${JSON.stringify(hostname)})`,
      ),
    ].join(" AND ");
  }

  private logQuery(options: QueryLogFilters): string {
    const { search, responseType, client, questionType } = options;
    const filters = [this.scopeQuery(options)];
    if (responseType) {
      filters.push(`response_type:exact(${JSON.stringify(responseType)})`);
    }
    if (client) {
      filters.push(regexFilter("client_names", client));
    }
    if (questionType) {
      filters.push(`question_type:exact(${JSON.stringify(questionType)})`);
    }
    if (search) {
      filters.push(regexFilter("question_name", search));
    }
    return filters.join(" AND ");
  }

  async getQueryLogRows(options: QueryLogsOptions): Promise<LogEntry[]> {
    const entries = await this.queryRaw(
      `${this.logQuery(options)} | sort by (_time desc, question_name asc, client_ip asc, question_type asc, response_type asc, answer asc, instance asc) | offset ${options.offset} | limit ${options.limit}`,
    );
    return entries.map((entry) => this.mapEntry(entry));
  }

  async getQueryLogCount(options: QueryLogFilters): Promise<number> {
    const result = await this.queryRaw(
      `${this.logQuery(options)} | stats count() as total`,
    );
    return Number(result[0]?.total ?? 0);
  }

  getQueryLogs(options: QueryLogsOptions): Promise<QueryLogsResult> {
    return readQueryLogPage(this, options);
  }

  async getQueriesOverTime(
    options: LogScope & {
      range: TimeRange;
      domain?: string;
      client?: string;
    },
  ): Promise<QueriesOverTimeEntry[]> {
    const { range, domain, client } = options;
    const { startTime, interval } = getTimeRangeConfig(range);
    const start = startTime.toISOString();
    const bucket = rangeToVlBucket(range);

    const filters = [this.scopeQuery(options)];
    if (domain) {
      filters.push(regexFilter("question_name", domain));
    }
    if (client) {
      filters.push(regexFilter("client_names", client));
    }
    const base = filters.join(" AND ");

    const [totalRows, blockedRows, cachedRows] = await Promise.all([
      this.queryRaw(
        `${base} | stats by (_time:${bucket}) count() as total | sort by (_time asc)`,
        { start },
      ),
      this.queryRaw(
        `${base} AND response_type:BLOCKED | stats by (_time:${bucket}) count() as blocked | sort by (_time asc)`,
        { start },
      ),
      this.queryRaw(
        `${base} AND response_type:CACHED | stats by (_time:${bucket}) count() as cached | sort by (_time asc)`,
        { start },
      ),
    ]);

    const totalMap = new Map(
      totalRows
        .filter(
          (r): r is Record<string, string> & { _time: string } =>
            r._time != null,
        )
        .map((r) => [toVlKey(r._time), Number(r.total)]),
    );
    const blockedMap = new Map(
      blockedRows
        .filter(
          (r): r is Record<string, string> & { _time: string } =>
            r._time != null,
        )
        .map((r) => [toVlKey(r._time), Number(r.blocked)]),
    );
    const cachedMap = new Map(
      cachedRows
        .filter(
          (r): r is Record<string, string> & { _time: string } =>
            r._time != null,
        )
        .map((r) => [toVlKey(r._time), Number(r.cached)]),
    );

    return fillVlTimeBuckets(
      totalMap,
      blockedMap,
      cachedMap,
      startTime,
      interval,
    );
  }

  private rankedQuery(
    options: LogScope & {
      filter: "all" | "blocked";
      limit?: number;
      offset: number;
    },
  ) {
    const base = this.scopeQuery(options);
    return {
      base:
        options.filter === "blocked"
          ? `${base} AND response_type:BLOCKED`
          : base,
      pagination:
        options.limit === undefined
          ? ""
          : `| offset ${options.offset} | limit ${options.limit}`,
    };
  }

  async getTopDomains(
    options: LogScope & {
      range: TimeRange;
      limit?: number;
      offset: number;
      filter: "all" | "blocked";
    },
  ): Promise<{ items: TopDomainEntry[]; totalCount: number }> {
    const { range, filter } = options;
    const start = rangeToVlStart(range);
    const { base, pagination } = this.rankedQuery(options);

    const [dataRows, countResult, totalQueriesResult] = await Promise.all([
      this.queryRaw(
        `${base} | stats by (question_name) count() as count | format "<lc:question_name>" as __qname_sort | sort by (count desc, __qname_sort asc) ${pagination}`,
        { start },
      ),
      // Number of distinct domains (for pagination totalCount).
      // count_uniq excludes empty-string values so chained stats is used
      // instead: group by field first (includes empty-string group for null
      // entries seeded as ""), then count the resulting groups.
      this.queryRaw(
        `${base} | stats by (question_name) count() | stats count() as total`,
        { start },
      ),
      this.queryRaw(`${base} | stats count() as n`, { start }),
    ]);

    const totalCount = Number(countResult[0]?.total ?? 0);
    const totalQueries = Number(totalQueriesResult[0]?.n ?? 0);

    const items = dataRows.map((r) => {
      const count = Number(r.count);
      const domain = r.question_name || "unknown";
      return {
        domain,
        count,
        blocked: filter === "blocked" ? count : 0,
        percentage: totalQueries > 0 ? (count / totalQueries) * 100 : 0,
      };
    });

    if (filter === "all" && items.length > 0) {
      const blockedRows = await this.queryRaw(
        `${this.scopeQuery(options)} AND response_type:BLOCKED | stats by (question_name) count() as blocked`,
        { start },
      );
      const blockedByDomain = new Map(
        blockedRows.map((r) => [
          r.question_name || "unknown",
          Number(r.blocked),
        ]),
      );
      for (const item of items) {
        item.blocked = blockedByDomain.get(item.domain) ?? 0;
      }
    }

    return { items, totalCount };
  }

  async getTopClients(
    options: LogScope & {
      range: TimeRange;
      limit?: number;
      offset: number;
      filter: "all" | "blocked";
    },
  ): Promise<{ items: TopClientEntry[]; totalCount: number }> {
    const { range, filter } = options;
    const start = rangeToVlStart(range);
    const { base, pagination } = this.rankedQuery(options);

    const [dataRows, countResult, totalQueriesResult] = await Promise.all([
      this.queryRaw(
        `${base} | stats by (client_names) count() as total | format "<lc:client_names>" as __client_sort | sort by (total desc, __client_sort asc) ${pagination}`,
        { start },
      ),
      // Same chained-stats pattern as getTopDomains for null-entry inclusion.
      this.queryRaw(
        `${base} | stats by (client_names) count() | stats count() as total`,
        { start },
      ),
      this.queryRaw(`${base} | stats count() as n`, { start }),
    ]);

    const totalCount = Number(countResult[0]?.total ?? 0);
    const totalQueries = Number(totalQueriesResult[0]?.n ?? 0);

    const items = dataRows.map((r) => {
      const total = Number(r.total);
      const client = r.client_names || "unknown";
      return {
        client,
        total,
        blocked: filter === "blocked" ? total : 0,
        percentage: totalQueries > 0 ? (total / totalQueries) * 100 : 0,
      };
    });

    if (filter === "all" && items.length > 0) {
      const blockedRows = await this.queryRaw(
        `${this.scopeQuery(options)} AND response_type:BLOCKED | stats by (client_names) count() as blocked`,
        { start },
      );
      const blockedByClient = new Map(
        blockedRows.map((r) => [
          r.client_names || "unknown",
          Number(r.blocked),
        ]),
      );
      for (const item of items) {
        item.blocked = blockedByClient.get(item.client) ?? 0;
      }
    }

    return { items, totalCount };
  }

  async getQueryTypesBreakdown(
    range: TimeRange,
    scope: LogScope = {},
  ): Promise<QueryTypeEntry[]> {
    const rows = await this.queryRaw(
      `${this.scopeQuery(scope)} | stats by (question_type) count() as count | format "<lc:question_type>" as __qtype_sort | sort by (count desc, __qtype_sort asc)`,
      { start: rangeToVlStart(range) },
    );
    const totalCount = rows.reduce((s, r) => s + Number(r.count), 0);
    return rows.map((r) => {
      const count = Number(r.count);
      return {
        type: r.question_type || "unknown",
        count,
        percentage: totalCount > 0 ? (count / totalCount) * 100 : 0,
      };
    });
  }
}
