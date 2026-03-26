import ky from "ky";
import { getTimeRangeConfig } from "~/server/logs/aggregation-utils";
import type {
  LogEntry,
  LogProvider,
  QueriesOverTimeEntry,
  QueryLogsOptions,
  QueryLogsResult,
  QueryTypeEntry,
  SearchClientEntry,
  SearchDomainEntry,
  StatsResult,
  TopClientEntry,
  TopDomainEntry,
} from "~/server/logs/types";
import type { TimeRange } from "~/lib/constants";

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

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export class VictoriaLogsProvider implements LogProvider {
  private readonly client: typeof ky;

  constructor({ url }: { url: string }) {
    this.client = ky.create({
      prefixUrl: url.replace(/\/$/, ""),
      timeout: 30_000,
    });
  }

  private async queryRaw(
    logql: string,
    params: { start?: string; limit?: number } = {},
  ): Promise<Record<string, string>[]> {
    const searchParams = new URLSearchParams({ query: logql });
    if (params.start) searchParams.set("start", params.start);
    if (params.limit !== undefined)
      searchParams.set("limit", String(params.limit));

    const text = await this.client
      .get("select/logsql/query", { searchParams })
      .text();

    return text
      .trim()
      .split("\n")
      .filter(Boolean)
      .flatMap((line) => {
        try {
          return [JSON.parse(line) as Record<string, string>];
        } catch {
          console.error("VictoriaLogs: failed to parse response line:", line);
          return [];
        }
      });
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
      hostname: null,
      effectiveTldp: null,
      id: null,
    };
  }

  async getQueryLogs(options: QueryLogsOptions): Promise<QueryLogsResult> {
    const { limit, offset, search, responseType, client, questionType } =
      options;

    const filters = ["app:blocky AND prefix:queryLog"];
    if (responseType) filters.push(`response_type:${responseType}`);
    if (client) filters.push(`client_names:~"(?i)${escapeRegex(client)}"`);
    if (questionType) filters.push(`question_type:${questionType}`);
    if (search) filters.push(`question_name:~"(?i)${escapeRegex(search)}"`);

    const baseQuery = filters.join(" AND ");

    const [entries, countResult] = await Promise.all([
      this.queryRaw(`${baseQuery} | sort by (_time desc)`, {
        limit: limit + offset,
      }),
      this.queryRaw(`${baseQuery} | stats count() as total`),
    ]);

    return {
      items: entries.slice(offset).map((r) => this.mapEntry(r)),
      totalCount: Number(countResult[0]?.total ?? 0),
    };
  }
  async getStats24h(): Promise<StatsResult> {
    const [totalResult, blockedResult] = await Promise.all([
      this.queryRaw("app:blocky AND prefix:queryLog | stats count() as total", {
        start: "24h",
      }),
      this.queryRaw(
        "app:blocky AND prefix:queryLog AND response_type:BLOCKED | stats count() as blocked",
        { start: "24h" },
      ),
    ]);

    return {
      totalQueries: Number(totalResult[0]?.total ?? 0),
      blocked: Number(blockedResult[0]?.blocked ?? 0),
    };
  }
  async getQueriesOverTime(options: {
    range: TimeRange;
    domain?: string;
    client?: string;
  }): Promise<QueriesOverTimeEntry[]> {
    const { range, domain, client } = options;
    const start = rangeToVlStart(range);
    const bucket = rangeToVlBucket(range);

    const filters = ["app:blocky AND prefix:queryLog"];
    if (domain) filters.push(`question_name:~"(?i)${escapeRegex(domain)}"`);
    if (client) filters.push(`client_names:~"(?i)${escapeRegex(client)}"`);
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

    const blockedByTime = new Map(
      blockedRows.map((r) => [r._time, Number(r.blocked)]),
    );
    const cachedByTime = new Map(
      cachedRows.map((r) => [r._time, Number(r.cached)]),
    );

    return totalRows
      .filter((r) => r._time != null)
      .map((r) => {
        const time = r._time!;
        return {
          time,
          total: Number(r.total),
          blocked: blockedByTime.get(time) ?? 0,
          cached: cachedByTime.get(time) ?? 0,
        };
      });
  }
  async getTopDomains(options: {
    range: TimeRange;
    limit: number;
    offset: number;
    filter: "all" | "blocked";
  }): Promise<{ items: TopDomainEntry[]; totalCount: number }> {
    const { range, limit, offset, filter } = options;
    const start = rangeToVlStart(range);
    const base = "app:blocky AND prefix:queryLog";
    const blockedBase = `${base} AND response_type:BLOCKED`;

    if (filter === "blocked") {
      const rows = await this.queryRaw(
        `${blockedBase} | stats by (question_name) count() as count | sort by (count desc)`,
        { start },
      );
      const totalQueries = rows.reduce((s, r) => s + Number(r.count), 0);
      return {
        totalCount: rows.length,
        items: rows.slice(offset, offset + limit).map((r) => {
          const count = Number(r.count);
          return {
            domain: r.question_name || "unknown",
            count,
            blocked: count,
            percentage: totalQueries > 0 ? (count / totalQueries) * 100 : 0,
          };
        }),
      };
    }

    const [allRows, blockedRows] = await Promise.all([
      this.queryRaw(
        `${base} | stats by (question_name) count() as count | sort by (count desc)`,
        { start },
      ),
      this.queryRaw(
        `${blockedBase} | stats by (question_name) count() as blocked`,
        { start },
      ),
    ]);

    const blockedByDomain = new Map(
      blockedRows.map((r) => [r.question_name || "unknown", Number(r.blocked)]),
    );
    const totalQueries = allRows.reduce((s, r) => s + Number(r.count), 0);

    return {
      totalCount: allRows.length,
      items: allRows.slice(offset, offset + limit).map((r) => {
        const domain = r.question_name || "unknown";
        const count = Number(r.count);
        return {
          domain,
          count,
          blocked: blockedByDomain.get(domain) ?? 0,
          percentage: totalQueries > 0 ? (count / totalQueries) * 100 : 0,
        };
      }),
    };
  }
  async getTopClients(options: {
    range: TimeRange;
    limit: number;
    offset: number;
    filter: "all" | "blocked";
  }): Promise<{ items: TopClientEntry[]; totalCount: number }> {
    const { range, limit, offset, filter } = options;
    const start = rangeToVlStart(range);
    const base = "app:blocky AND prefix:queryLog";
    const blockedBase = `${base} AND response_type:BLOCKED`;

    if (filter === "blocked") {
      const rows = await this.queryRaw(
        `${blockedBase} | stats by (client_names) count() as total | sort by (total desc)`,
        { start },
      );
      const totalQueries = rows.reduce((s, r) => s + Number(r.total), 0);
      return {
        totalCount: rows.length,
        items: rows.slice(offset, offset + limit).map((r) => {
          const total = Number(r.total);
          return {
            client: r.client_names || "unknown",
            total,
            blocked: total,
            percentage: totalQueries > 0 ? (total / totalQueries) * 100 : 0,
          };
        }),
      };
    }

    const [allRows, blockedRows] = await Promise.all([
      this.queryRaw(
        `${base} | stats by (client_names) count() as total | sort by (total desc)`,
        { start },
      ),
      this.queryRaw(
        `${blockedBase} | stats by (client_names) count() as blocked`,
        { start },
      ),
    ]);

    const blockedByClient = new Map(
      blockedRows.map((r) => [r.client_names || "unknown", Number(r.blocked)]),
    );
    const totalQueries = allRows.reduce((s, r) => s + Number(r.total), 0);

    return {
      totalCount: allRows.length,
      items: allRows.slice(offset, offset + limit).map((r) => {
        const client = r.client_names || "unknown";
        const total = Number(r.total);
        return {
          client,
          total,
          blocked: blockedByClient.get(client) ?? 0,
          percentage: totalQueries > 0 ? (total / totalQueries) * 100 : 0,
        };
      }),
    };
  }
  async getQueryTypesBreakdown(range: TimeRange): Promise<QueryTypeEntry[]> {
    const rows = await this.queryRaw(
      "app:blocky AND prefix:queryLog | stats by (question_type) count() as count | sort by (count desc)",
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
  async searchDomains(options: {
    range: TimeRange;
    query: string;
    limit: number;
  }): Promise<SearchDomainEntry[]> {
    if (!options.query.trim()) return [];

    const rows = await this.queryRaw(
      `app:blocky AND prefix:queryLog AND question_name:~"(?i)${escapeRegex(options.query)}" | stats by (question_name) count() as count | sort by (count desc) | limit ${options.limit}`,
      { start: rangeToVlStart(options.range) },
    );
    return rows.map((r) => ({
      domain: r.question_name || "unknown",
      count: Number(r.count),
    }));
  }
  async searchClients(options: {
    range: TimeRange;
    query: string;
    limit: number;
  }): Promise<SearchClientEntry[]> {
    if (!options.query.trim()) return [];

    const rows = await this.queryRaw(
      `app:blocky AND prefix:queryLog AND client_names:~"(?i)${escapeRegex(options.query)}" | stats by (client_names) count() as count | sort by (count desc) | limit ${options.limit}`,
      { start: rangeToVlStart(options.range) },
    );
    return rows.map((r) => ({
      client: r.client_names || "unknown",
      count: Number(r.count),
    }));
  }
}
