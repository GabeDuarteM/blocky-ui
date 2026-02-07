/**
 * Base class for SQL database log providers (MySQL, PostgreSQL, etc.)
 *
 * Subclasses must implement:
 * - getBucketExpression(range): Returns SQL expression for time bucketing
 */

import { desc, sql, and, eq, gte, type SQL, type Column } from "drizzle-orm";
import { type TimeRange } from "~/lib/constants";
import { getTimeRangeConfig } from "~/server/logs/aggregation-utils";
import type {
  LogProvider,
  LogEntry,
  StatsResult,
  QueriesOverTimeEntry,
  TopDomainEntry,
  TopClientEntry,
  QueryTypeEntry,
  SearchDomainEntry,
  SearchClientEntry,
  QueryLogsOptions,
  QueryLogsResult,
} from "~/server/logs/types";

/**
 * Interface for the log_entries table columns.
 * All SQL providers must have a table with at least these columns.
 */
export interface LogEntriesColumns {
  id?: Column;
  requestTs: Column;
  clientIp: Column;
  clientName: Column;
  durationMs: Column;
  reason: Column;
  responseType: Column;
  questionType: Column;
  questionName: Column;
  effectiveTldp: Column;
  answer: Column;
  responseCode: Column;
  hostname: Column;
}

// Generic database type that works with any Drizzle SQL database
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyDrizzleDb = any;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyTable = any;

type SqlFilter = ReturnType<typeof eq>;

export interface BaseSqlLogProviderConfig {
  db: AnyDrizzleDb;
  table: AnyTable;
  columns: LogEntriesColumns;
}

/**
 * Abstract base class for SQL database log providers.
 * Subclasses can override any method if they need database-specific optimizations.
 */
export abstract class BaseSqlLogProvider implements LogProvider {
  protected readonly db: AnyDrizzleDb;
  protected readonly table: AnyTable;
  protected readonly columns: LogEntriesColumns;

  constructor(config: BaseSqlLogProviderConfig) {
    this.db = config.db;
    this.table = config.table;
    this.columns = config.columns;
  }

  /**
   * Returns a SQL expression that buckets timestamps for the given time range.
   * This is database-specific.
   */
  protected abstract getBucketExpression(range: TimeRange): SQL;

  private buildFiltersAndGetTotalCount(options: {
    range: TimeRange;
    filter: "all" | "blocked";
  }): {
    filters: SqlFilter[];
    getTotalCount: () => Promise<number>;
  } {
    const { startTime } = getTimeRangeConfig(options.range);
    const filters: SqlFilter[] = [
      gte(this.columns.requestTs, startTime.toISOString()),
    ];
    if (options.filter === "blocked") {
      filters.push(eq(this.columns.responseType, "BLOCKED"));
    }

    const getTotalCount = async () => {
      const result = await this.db
        .select({ count: sql<number>`count(*)` })
        .from(this.table)
        .where(and(...filters));
      return Number(result[0]?.count ?? 0);
    };

    return { filters, getTotalCount };
  }

  /**
   * Maps a database row to a LogEntry object.
   * Handles nullable fields and optional id.
   */
  protected mapRowToLogEntry(row: Record<string, unknown>): LogEntry {
    const toNullableString = (value: unknown): string | null =>
      typeof value === "string" ? value : null;

    const toNullableNumber = (value: unknown): number | null => {
      if (value == null) return null;
      const num = typeof value === "number" ? value : Number(value);
      return Number.isFinite(num) ? num : null;
    };

    return {
      id: row.id != null ? Number(row.id) : undefined,
      requestTs: toNullableString(row.requestTs),
      clientIp: toNullableString(row.clientIp),
      clientName: toNullableString(row.clientName),
      durationMs: toNullableNumber(row.durationMs),
      reason: toNullableString(row.reason),
      questionName: toNullableString(row.questionName),
      answer: toNullableString(row.answer),
      responseCode: toNullableString(row.responseCode),
      responseType: toNullableString(row.responseType),
      questionType: toNullableString(row.questionType),
      hostname: toNullableString(row.hostname),
      effectiveTldp: toNullableString(row.effectiveTldp),
    };
  }

  async getQueryLogs(options: QueryLogsOptions): Promise<QueryLogsResult> {
    const filters = [];

    if (options.search) {
      filters.push(
        sql`LOWER(${this.columns.questionName}) LIKE LOWER(${`%${options.search}%`})`,
      );
    }

    if (options.responseType) {
      filters.push(eq(this.columns.responseType, options.responseType));
    }

    if (options.client) {
      filters.push(
        sql`LOWER(${this.columns.clientName}) LIKE LOWER(${`%${options.client}%`})`,
      );
    }

    if (options.questionType) {
      filters.push(eq(this.columns.questionType, options.questionType));
    }

    const countQuery = this.db
      .select({ count: sql<number>`count(*)` })
      .from(this.table)
      .where(filters.length > 0 ? and(...filters) : undefined);

    const countResult = await countQuery;
    const count = countResult?.[0]?.count ?? 0;

    const selectFields: Record<string, Column | SQL> = {
      requestTs: this.columns.requestTs,
      clientIp: this.columns.clientIp,
      clientName: this.columns.clientName,
      durationMs: this.columns.durationMs,
      reason: this.columns.reason,
      questionName: this.columns.questionName,
      answer: this.columns.answer,
      responseCode: this.columns.responseCode,
      responseType: this.columns.responseType,
      questionType: this.columns.questionType,
      hostname: this.columns.hostname,
      effectiveTldp: this.columns.effectiveTldp,
    };

    // Only include id if the table has it
    if (this.columns.id) {
      selectFields.id = this.columns.id;
    }

    const query = this.db
      .select(selectFields)
      .from(this.table)
      .orderBy(desc(this.columns.requestTs))
      .limit(options.limit)
      .offset(options.offset)
      .where(filters.length > 0 ? and(...filters) : undefined);

    const rows = await query;

    return {
      items: rows.map((row: Record<string, unknown>) =>
        this.mapRowToLogEntry(row),
      ),
      totalCount: Number(count),
    };
  }

  async getStats24h(): Promise<StatsResult> {
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const result = await this.db
      .select({
        totalQueries: sql<number>`count(*)`,
        blocked: sql<number>`sum(case when ${this.columns.responseType} = 'BLOCKED' then 1 else 0 end)`,
      })
      .from(this.table)
      .where(gte(this.columns.requestTs, oneDayAgo.toISOString()));

    return {
      totalQueries: Number(result[0]?.totalQueries ?? 0),
      blocked: Number(result[0]?.blocked ?? 0),
    };
  }

  async getQueriesOverTime(options: {
    range: TimeRange;
    domain?: string;
    client?: string;
  }): Promise<QueriesOverTimeEntry[]> {
    const { startTime, interval } = getTimeRangeConfig(options.range);
    const bucketExpr = this.getBucketExpression(options.range);

    const filters = [gte(this.columns.requestTs, startTime.toISOString())];

    if (options.domain) {
      filters.push(
        sql`LOWER(${this.columns.questionName}) LIKE LOWER(${`%${options.domain}%`})`,
      );
    }

    if (options.client) {
      filters.push(
        sql`LOWER(${this.columns.clientName}) LIKE LOWER(${`%${options.client}%`})`,
      );
    }

    const result = await this.db
      .select({
        timeBucket: sql<string>`${bucketExpr}`,
        total: sql<number>`count(*)`,
        blocked: sql<number>`sum(case when ${this.columns.responseType} = 'BLOCKED' then 1 else 0 end)`,
        cached: sql<number>`sum(case when ${this.columns.responseType} = 'CACHED' then 1 else 0 end)`,
      })
      .from(this.table)
      .where(and(...filters))
      .groupBy(sql`${bucketExpr}`)
      .orderBy(sql`${bucketExpr}`);

    return fillTimeBuckets(result, startTime, interval, options.range);
  }

  async getTopDomains(options: {
    range: TimeRange;
    limit: number;
    offset: number;
    filter: "all" | "blocked";
  }): Promise<{ items: TopDomainEntry[]; totalCount: number }> {
    const { filters, getTotalCount } =
      this.buildFiltersAndGetTotalCount(options);
    const totalQueriesCount = await getTotalCount();

    const uniqueDomainsResult = await this.db
      .select({
        count: sql<number>`count(distinct ${this.columns.questionName})`,
      })
      .from(this.table)
      .where(and(...filters));
    const totalCount = Number(uniqueDomainsResult[0]?.count ?? 0);

    const result = await this.db
      .select({
        domain: this.columns.questionName,
        count: sql<number>`count(*)`,
        blocked: sql<number>`sum(case when ${this.columns.responseType} = 'BLOCKED' then 1 else 0 end)`,
      })
      .from(this.table)
      .where(and(...filters))
      .groupBy(this.columns.questionName)
      .orderBy(desc(sql`count(*)`))
      .limit(options.limit)
      .offset(options.offset);

    return {
      items: result.map(
        (row: { domain: string | null; count: number; blocked: number }) => ({
          domain: row.domain ?? "unknown",
          count: Number(row.count),
          blocked: Number(row.blocked),
          percentage:
            totalQueriesCount > 0
              ? (Number(row.count) / totalQueriesCount) * 100
              : 0,
        }),
      ),
      totalCount,
    };
  }

  async getTopClients(options: {
    range: TimeRange;
    limit: number;
    offset: number;
    filter: "all" | "blocked";
  }): Promise<{ items: TopClientEntry[]; totalCount: number }> {
    const { filters, getTotalCount } =
      this.buildFiltersAndGetTotalCount(options);
    const totalQueriesCount = await getTotalCount();

    const uniqueClientsResult = await this.db
      .select({
        count: sql<number>`count(distinct ${this.columns.clientName})`,
      })
      .from(this.table)
      .where(and(...filters));
    const totalCount = Number(uniqueClientsResult[0]?.count ?? 0);

    const result = await this.db
      .select({
        client: this.columns.clientName,
        total: sql<number>`count(*)`,
        blocked: sql<number>`sum(case when ${this.columns.responseType} = 'BLOCKED' then 1 else 0 end)`,
      })
      .from(this.table)
      .where(and(...filters))
      .groupBy(this.columns.clientName)
      .orderBy(desc(sql`count(*)`))
      .limit(options.limit)
      .offset(options.offset);

    return {
      items: result.map(
        (row: { client: string | null; total: number; blocked: number }) => ({
          client: row.client ?? "unknown",
          total: Number(row.total),
          blocked: Number(row.blocked),
          percentage:
            totalQueriesCount > 0
              ? (Number(row.total) / totalQueriesCount) * 100
              : 0,
        }),
      ),
      totalCount,
    };
  }

  async getQueryTypesBreakdown(range: TimeRange): Promise<QueryTypeEntry[]> {
    const { startTime } = getTimeRangeConfig(range);

    const totalResult = await this.db
      .select({ count: sql<number>`count(*)` })
      .from(this.table)
      .where(gte(this.columns.requestTs, startTime.toISOString()));
    const totalCount = Number(totalResult[0]?.count ?? 0);

    const result = await this.db
      .select({
        type: this.columns.questionType,
        count: sql<number>`count(*)`,
      })
      .from(this.table)
      .where(gte(this.columns.requestTs, startTime.toISOString()))
      .groupBy(this.columns.questionType)
      .orderBy(desc(sql`count(*)`));

    return result.map((row: { type: string | null; count: number }) => ({
      type: row.type ?? "unknown",
      count: Number(row.count),
      percentage: totalCount > 0 ? (Number(row.count) / totalCount) * 100 : 0,
    }));
  }

  async searchDomains(options: {
    range: TimeRange;
    query: string;
    limit: number;
  }): Promise<SearchDomainEntry[]> {
    if (!options.query.trim()) {
      return [];
    }

    const { startTime } = getTimeRangeConfig(options.range);

    const result = await this.db
      .select({
        domain: this.columns.questionName,
        count: sql<number>`count(*)`,
      })
      .from(this.table)
      .where(
        and(
          gte(this.columns.requestTs, startTime.toISOString()),
          sql`LOWER(${this.columns.questionName}) LIKE LOWER(${`%${options.query}%`})`,
        ),
      )
      .groupBy(this.columns.questionName)
      .orderBy(desc(sql`count(*)`))
      .limit(options.limit);

    return result.map((row: { domain: string | null; count: number }) => ({
      domain: row.domain ?? "unknown",
      count: Number(row.count),
    }));
  }

  async searchClients(options: {
    range: TimeRange;
    query: string;
    limit: number;
  }): Promise<SearchClientEntry[]> {
    if (!options.query.trim()) {
      return [];
    }

    const { startTime } = getTimeRangeConfig(options.range);

    const result = await this.db
      .select({
        client: this.columns.clientName,
        count: sql<number>`count(*)`,
      })
      .from(this.table)
      .where(
        and(
          gte(this.columns.requestTs, startTime.toISOString()),
          sql`LOWER(${this.columns.clientName}) LIKE LOWER(${`%${options.query}%`})`,
        ),
      )
      .groupBy(this.columns.clientName)
      .orderBy(desc(sql`count(*)`))
      .limit(options.limit);

    return result.map((row: { client: string | null; count: number }) => ({
      client: row.client ?? "unknown",
      count: Number(row.count),
    }));
  }
}

/**
 * Fills in missing time buckets with zero values.
 */
export function fillTimeBuckets(
  data: {
    timeBucket: string;
    total: number;
    blocked: number;
    cached: number;
  }[],
  startTime: Date,
  interval: number,
  range: TimeRange,
): QueriesOverTimeEntry[] {
  const dataMap = new Map(data.map((d) => [d.timeBucket, d]));
  const results: QueriesOverTimeEntry[] = [];
  const now = Date.now();
  let current = startTime.getTime();

  while (current <= now) {
    const date = new Date(current);
    const key = formatDateForRange(date, range);

    const entry = dataMap.get(key);
    results.push({
      time: date.toISOString(),
      total: Number(entry?.total ?? 0),
      blocked: Number(entry?.blocked ?? 0),
      cached: Number(entry?.cached ?? 0),
    });

    current += interval;
  }

  return results;
}

/**
 * Formats a date to match the SQL bucket expression output.
 */
export function formatDateForRange(date: Date, range: TimeRange): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  const hours = String(date.getUTCHours()).padStart(2, "0");

  switch (range) {
    case "1h": {
      const minutes = String(Math.floor(date.getUTCMinutes() / 5) * 5).padStart(
        2,
        "0",
      );
      return `${year}-${month}-${day} ${hours}:${minutes}`;
    }
    case "24h":
      return `${year}-${month}-${day} ${hours}:00`;
    case "7d": {
      const flooredHours = String(
        Math.floor(date.getUTCHours() / 6) * 6,
      ).padStart(2, "0");
      return `${year}-${month}-${day} ${flooredHours}:00`;
    }
    case "30d":
      return `${year}-${month}-${day}`;
  }
}
