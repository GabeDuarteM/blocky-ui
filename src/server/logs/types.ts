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

export interface SearchDomainEntry {
  domain: string;
  count: number;
}

export interface SearchClientEntry {
  client: string;
  count: number;
}

export interface QueryLogsOptions {
  limit: number;
  offset: number;
  search?: string;
  responseType?: string;
  client?: string;
  questionType?: string;
}

export interface QueryLogsResult {
  items: LogEntry[];
  totalCount: number;
}

export interface LogProvider {
  close?(): Promise<void>;

  getQueryLogs(options: QueryLogsOptions): Promise<QueryLogsResult>;

  getStats24h(): Promise<StatsResult>;

  getQueriesOverTime(options: {
    range: TimeRange;
    domain?: string;
    client?: string;
  }): Promise<QueriesOverTimeEntry[]>;

  getTopDomains(options: {
    range: TimeRange;
    limit: number;
    offset: number;
    filter: "all" | "blocked";
  }): Promise<{ items: TopDomainEntry[]; totalCount: number }>;

  getTopClients(options: {
    range: TimeRange;
    limit: number;
    offset: number;
    filter: "all" | "blocked";
  }): Promise<{ items: TopClientEntry[]; totalCount: number }>;

  getQueryTypesBreakdown(range: TimeRange): Promise<QueryTypeEntry[]>;

  searchDomains(options: {
    range: TimeRange;
    query: string;
    limit: number;
  }): Promise<SearchDomainEntry[]>;

  searchClients(options: {
    range: TimeRange;
    query: string;
    limit: number;
  }): Promise<SearchClientEntry[]>;
}
