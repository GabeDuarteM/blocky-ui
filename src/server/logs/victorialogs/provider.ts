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
      .map((line) => JSON.parse(line) as Record<string, string>);
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
    if (client) filters.push(`client_names:~"(?i)${client}"`);
    if (questionType) filters.push(`question_type:${questionType}`);
    if (search) filters.push(`question_name:~"(?i)${search}"`);

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
    throw new Error("Not implemented");
  }
  async getQueriesOverTime(_options: {
    range: TimeRange;
    domain?: string;
    client?: string;
  }): Promise<QueriesOverTimeEntry[]> {
    throw new Error("Not implemented");
  }
  async getTopDomains(_options: {
    range: TimeRange;
    limit: number;
    offset: number;
    filter: "all" | "blocked";
  }): Promise<{ items: TopDomainEntry[]; totalCount: number }> {
    throw new Error("Not implemented");
  }
  async getTopClients(_options: {
    range: TimeRange;
    limit: number;
    offset: number;
    filter: "all" | "blocked";
  }): Promise<{ items: TopClientEntry[]; totalCount: number }> {
    throw new Error("Not implemented");
  }
  async getQueryTypesBreakdown(_range: TimeRange): Promise<QueryTypeEntry[]> {
    throw new Error("Not implemented");
  }
  async searchDomains(_options: {
    range: TimeRange;
    query: string;
    limit: number;
  }): Promise<SearchDomainEntry[]> {
    throw new Error("Not implemented");
  }
  async searchClients(_options: {
    range: TimeRange;
    query: string;
    limit: number;
  }): Promise<SearchClientEntry[]> {
    throw new Error("Not implemented");
  }
}
