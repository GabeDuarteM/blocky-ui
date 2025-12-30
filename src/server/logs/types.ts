import { type TimeRange } from "~/lib/constants";

export interface LogEntry {
  requestTs: string | null;
  clientIp: string | null;
  clientName: string | null;
  durationMs: number | null;
  reason: string | null;
  questionName: string | null;
  answer: string | null;
  responseCode: string | null;
  responseType: string | null;
  questionType: string | null;
  hostname: string | null;
  effectiveTldp: string | null;
  id: number | null;
}

export interface StatsResult {
  totalQueries: number;
  blocked: number;
}

export interface QueriesOverTimeEntry {
  time: string;
  total: number;
  blocked: number;
  cached: number;
}

export interface TopDomainEntry {
  domain: string;
  count: number;
  blocked: number;
  percentage: number;
}

export interface TopClientEntry {
  client: string;
  total: number;
  blocked: number;
  percentage: number;
}

export interface QueryTypeEntry {
  type: string;
  count: number;
  percentage: number;
}

export interface LogProvider {
  getQueryLogs(options: {
    limit: number;
    offset: number;
    search?: string;
    responseType?: string;
  }): Promise<{
    items: LogEntry[];
    totalCount: number;
  }>;

  getStats24h(): Promise<StatsResult>;

  getQueriesOverTime(range: TimeRange): Promise<QueriesOverTimeEntry[]>;

  getTopDomains(options: {
    range: TimeRange;
    limit: number;
    filter: "all" | "blocked";
  }): Promise<TopDomainEntry[]>;

  getTopClients(options: {
    range: TimeRange;
    limit: number;
  }): Promise<TopClientEntry[]>;

  getQueryTypesBreakdown(range: TimeRange): Promise<QueryTypeEntry[]>;
}
