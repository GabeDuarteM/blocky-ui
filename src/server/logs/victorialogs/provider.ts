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

  async getQueryLogs(_options: QueryLogsOptions): Promise<QueryLogsResult> {
    throw new Error("Not implemented");
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
