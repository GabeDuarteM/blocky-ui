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
  /** Not present in Timescale */
  id?: number | null;
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

export interface LogScope {
  excludedHostnames?: string[];
}

export interface QueryLogFilters extends LogScope {
  maxId?: number;
  search?: string;
  responseType?: string;
  client?: string;
  questionType?: string;
}

export interface QueryLogsOptions extends QueryLogFilters {
  limit: number;
  offset: number;
}

export interface QueryLogsResult {
  items: LogEntry[];
  totalCount: number;
}

export interface LogProvider {
  close?(): Promise<void>;

  getQueryLogs(options: QueryLogsOptions): Promise<QueryLogsResult>;

  getQueryLogRows(options: QueryLogsOptions): Promise<LogEntry[]>;

  getQueryLogCount(options: QueryLogFilters): Promise<number>;

  getQueryLogSnapshot?(): Promise<number | undefined>;

  getQueryLogCountSince?(
    options: QueryLogFilters,
    since: Date,
  ): Promise<number>;

  getQueriesOverTime(
    options: LogScope & {
      range: TimeRange;
      domain?: string;
      client?: string;
    },
  ): Promise<QueriesOverTimeEntry[]>;

  getTopDomains(
    options: LogScope & {
      range: TimeRange;
      limit?: number;
      offset: number;
      filter: "all" | "blocked";
    },
  ): Promise<{ items: TopDomainEntry[]; totalCount: number }>;

  getTopClients(
    options: LogScope & {
      range: TimeRange;
      limit?: number;
      offset: number;
      filter: "all" | "blocked";
    },
  ): Promise<{ items: TopClientEntry[]; totalCount: number }>;

  getQueryTypesBreakdown(
    range: TimeRange,
    scope?: LogScope,
  ): Promise<QueryTypeEntry[]>;
}
