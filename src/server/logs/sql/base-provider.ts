import { readQueryLogPage } from "~/server/logs/query-page";
/**
 * Base class for SQL database log providers (MySQL, PostgreSQL, etc.)
 *
 * Subclasses must implement:
 * - getBucketExpression(range): Returns SQL expression for time bucketing
 */

import {
  and,
  asc,
  Column,
  desc,
  eq,
  gte,
  inArray,
  is,
  isNull,
  lte,
  notInArray,
  or,
  type SQL,
  sql,
} from "drizzle-orm";
import type { TimeRange } from "~/lib/constants";
import { getTimeRangeConfig } from "~/server/logs/aggregation-utils";
import type {
  LogEntry,
  LogProvider,
  LogScope,
  QueriesOverTimeEntry,
  QueryLogFilters,
  QueryLogsOptions,
  QueryLogsResult,
  QueryTypeEntry,
  TopClientEntry,
  TopDomainEntry,
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

interface SqlQuery extends PromiseLike<Record<string, unknown>[]> {
  groupBy: (...columns: SQL[]) => SqlQuery;
  limit: (count: number) => SqlQuery;
  offset: (count: number) => SqlQuery;
  orderBy: (...columns: SQL[]) => SqlQuery;
  where: (condition: SQL | undefined) => SqlQuery;
}

type SqlFilter = ReturnType<typeof eq>;

interface GroupedTotalsRow {
  totalCount: number;
  totalQueriesCount: number;
}

export interface BaseSqlLogProviderConfig {
  columns: LogEntriesColumns;
  select: (
    fields: Record<string, SQL>,
    indexHints?: { useIndex: string[] },
  ) => SqlQuery;
}

function getUtcDateParts(date: Date) {
  return {
    year: date.getUTCFullYear(),
    month: String(date.getUTCMonth() + 1).padStart(2, "0"),
    day: String(date.getUTCDate()).padStart(2, "0"),
    hours: String(date.getUTCHours()).padStart(2, "0"),
  };
}

/**
 * Abstract base class for SQL database log providers.
 * Subclasses can override any method if they need database-specific optimizations.
 */
export abstract class BaseSqlLogProvider implements LogProvider {
  private readonly selectQuery: BaseSqlLogProviderConfig["select"];
  protected readonly columns: LogEntriesColumns;

  constructor(config: BaseSqlLogProviderConfig) {
    this.selectQuery = config.select;
    this.columns = config.columns;
  }

  private select(
    fields: Record<string, Column | SQL>,
    indexHints?: { useIndex: string[] },
  ) {
    return this.selectQuery(
      Object.fromEntries(
        Object.entries(fields).map(([key, value]) => [
          key,
          is(value, Column) ? sql`${value}`.mapWith(value) : value,
        ]),
      ),
      indexHints,
    );
  }

  /**
   * Returns a SQL expression that buckets timestamps for the given time range.
   * This is database-specific.
   */
  protected abstract getBucketExpression(range: TimeRange): SQL;

  protected formatDateTimeForFilter(date: Date): string {
    const { year, month, day, hours } = getUtcDateParts(date);
    const minutes = String(date.getUTCMinutes()).padStart(2, "0");
    const seconds = String(date.getUTCSeconds()).padStart(2, "0");
    const milliseconds = String(date.getUTCMilliseconds()).padStart(3, "0");

    return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}.${milliseconds}`;
  }

  protected getTextSortExpression(column: Column): Column | SQL {
    return column;
  }

  private buildRangeFilters(
    options: LogScope & {
      range: TimeRange;
      filter: "all" | "blocked";
    },
  ): SqlFilter[] {
    const { startTime } = getTimeRangeConfig(options.range);
    const filters: SqlFilter[] = [
      ...this.scopeFilters(options),
      gte(this.columns.requestTs, this.formatDateTimeForFilter(startTime)),
    ];

    if (options.filter === "blocked") {
      filters.push(eq(this.columns.responseType, "BLOCKED"));
    }

    return filters;
  }

  private async getGroupedTotals(options: {
    filters: SqlFilter[];
    groupColumn: Column;
  }): Promise<{ totalCount: number; totalQueriesCount: number }> {
    const result = await this.select({
      totalCount: sql<number>`count(distinct coalesce(${options.groupColumn}, '__null__'))`,
      totalQueriesCount: sql<number>`count(*)`,
    }).where(and(...options.filters));

    return {
      totalCount: Number(result[0]?.totalCount ?? 0),
      totalQueriesCount: Number(result[0]?.totalQueriesCount ?? 0),
    };
  }

  private resolveGroupedTotals(options: {
    row: Record<string, unknown> | undefined;
    offset: number;
    filters: SqlFilter[];
    groupColumn: Column;
  }): Promise<GroupedTotalsRow> {
    if (!options.row && options.offset > 0) {
      return this.getGroupedTotals({
        filters: options.filters,
        groupColumn: options.groupColumn,
      });
    }

    return Promise.resolve({
      totalCount: Number(options.row?.totalCount ?? 0),
      totalQueriesCount: Number(options.row?.totalQueriesCount ?? 0),
    });
  }

  /**
   * Maps a database row to a LogEntry object.
   * Handles nullable fields and optional id.
   */
  protected mapRowToLogEntry(row: Record<string, unknown>): LogEntry {
    const toNullableString = (value: unknown): string | null =>
      typeof value === "string" ? value : null;

    const toNullableNumber = (value: unknown): number | null => {
      if (value === null || value === undefined) {
        return null;
      }
      const num = typeof value === "number" ? value : Number(value);
      return Number.isFinite(num) ? num : null;
    };

    return {
      id: row.id === null || row.id === undefined ? undefined : Number(row.id),
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

  protected hostnameExpression(): SQL {
    return sql`${this.columns.hostname}`;
  }

  private scopeFilters(scope: LogScope): SQL[] {
    if (!scope.excludedHostnames?.length) {
      return [];
    }
    const filter = or(
      isNull(this.columns.hostname),
      notInArray(this.hostnameExpression(), scope.excludedHostnames),
    );
    return filter ? [filter] : [];
  }

  protected clientFilter(client: string): Promise<SQL> {
    return Promise.resolve(
      sql`LOWER(${this.columns.clientName}) LIKE LOWER(${`%${client}%`})`,
    );
  }

  protected getClientRankingIndexHints(
    _range: TimeRange,
    _filter: "all" | "blocked",
  ): { useIndex: string[] } | undefined {
    return undefined;
  }

  private async buildLogFilters(options: QueryLogFilters): Promise<SQL[]> {
    const filters = this.scopeFilters(options);

    if (options.maxId !== undefined && this.columns.id) {
      filters.push(lte(this.columns.id, options.maxId));
    }

    if (options.search) {
      filters.push(
        sql`LOWER(${this.columns.questionName}) LIKE LOWER(${`%${options.search}%`})`,
      );
    }

    if (options.domain) {
      filters.push(
        sql`LOWER(${this.columns.questionName}) = LOWER(${options.domain})`,
      );
    }

    if (options.responseType) {
      filters.push(eq(this.columns.responseType, options.responseType));
    }

    if (options.client) {
      filters.push(await this.clientFilter(options.client));
    }

    if (options.questionType) {
      filters.push(eq(this.columns.questionType, options.questionType));
    }

    return filters;
  }

  async getQueryLogCount(options: QueryLogFilters): Promise<number> {
    const result = await this.select({ count: sql<number>`count(*)` }).where(
      and(...(await this.buildLogFilters(options))),
    );
    return Number(result[0]?.count ?? 0);
  }

  async getQueryLogSnapshot() {
    if (!this.columns.id) {
      return;
    }

    const result = await this.select({
      id: sql<number>`max(${this.columns.id})`,
    });

    return Number(result[0]?.id ?? 0);
  }

  async getQueryLogCountSince(
    options: QueryLogFilters,
    since: Date,
  ): Promise<number> {
    const timestamp = gte(
      this.columns.requestTs,
      this.formatDateTimeForFilter(since),
    );
    const result = await this.select({ count: sql<number>`count(*)` }).where(
      and(
        ...(await this.buildLogFilters(options)),
        since.getTime() <= 0
          ? or(timestamp, isNull(this.columns.requestTs))
          : timestamp,
      ),
    );

    return Number(result[0]?.count ?? 0);
  }

  getQueryLogRows(options: QueryLogsOptions): Promise<LogEntry[]> {
    return this.readQueryLogRows(options);
  }

  protected queryLogTimestampOrder(): SQL {
    return desc(this.columns.requestTs);
  }

  protected async readQueryLogRows(
    options: QueryLogsOptions,
    extraFilters: SQL[] = [],
    indexHints?: { useIndex: string[] },
  ): Promise<LogEntry[]> {
    const filters = [...(await this.buildLogFilters(options)), ...extraFilters];
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

    const order = [
      this.queryLogTimestampOrder(),
      ...(this.columns.id
        ? [desc(this.columns.id)]
        : [
            asc(this.columns.questionName),
            asc(this.columns.clientIp),
            asc(this.columns.questionType),
            asc(this.columns.responseType),
            asc(this.columns.answer),
          ]),
    ];
    const seekById = options.offset > 0 && this.columns.id;
    const query = this.select(
      seekById ? { id: seekById } : selectFields,
      indexHints,
    )
      .orderBy(...order)
      .limit(options.limit)
      .offset(options.offset)
      .where(filters.length > 0 ? and(...filters) : undefined);

    let rows = await query;

    if (seekById && rows.length > 0) {
      rows = await this.select(selectFields)
        .where(
          and(
            ...filters,
            inArray(
              seekById,
              rows.map((row: Record<string, unknown>) => Number(row.id)),
            ),
          ),
        )
        .orderBy(...order);
    }
    return rows.map((row: Record<string, unknown>) =>
      this.mapRowToLogEntry(row),
    );
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
    const { startTime, interval } = getTimeRangeConfig(options.range);
    const bucketExpr = this.getBucketExpression(options.range);

    const filters = [
      ...this.scopeFilters(options),
      gte(this.columns.requestTs, this.formatDateTimeForFilter(startTime)),
    ];

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

    const result = await this.select({
      timeBucket: sql<string>`${bucketExpr}`,
      total: sql<number>`count(*)`,
      blocked: sql<number>`sum(case when ${this.columns.responseType} = 'BLOCKED' then 1 else 0 end)`,
      cached: sql<number>`sum(case when ${this.columns.responseType} = 'CACHED' then 1 else 0 end)`,
    })
      .where(and(...filters))
      .groupBy(sql`${bucketExpr}`)
      .orderBy(sql`${bucketExpr}`);

    return fillTimeBuckets(result, startTime, interval, options.range);
  }

  async getTopDomains(
    options: LogScope & {
      range: TimeRange;
      limit?: number;
      offset: number;
      filter: "all" | "blocked";
    },
  ): Promise<{ items: TopDomainEntry[]; totalCount: number }> {
    const filters = this.buildRangeFilters(options);

    const query = this.select({
      domain: this.columns.questionName,
      count: sql<number>`count(*)`,
      blocked: sql<number>`sum(case when ${this.columns.responseType} = 'BLOCKED' then 1 else 0 end)`,
      totalCount: sql<number>`count(*) over ()`,
      totalQueriesCount: sql<number>`sum(count(*)) over ()`,
    })
      .where(and(...filters))
      .groupBy(sql`${this.columns.questionName}`)
      .orderBy(
        desc(sql`count(*)`),
        asc(this.getTextSortExpression(this.columns.questionName)),
        asc(this.columns.questionName),
      );
    const result = await (options.limit === undefined
      ? query
      : query.limit(options.limit).offset(options.offset));

    const { totalQueriesCount, totalCount } = await this.resolveGroupedTotals({
      row: result[0],
      offset: options.offset,
      filters,
      groupColumn: this.columns.questionName,
    });

    return {
      items: result.map((row) => ({
        domain: typeof row.domain === "string" ? row.domain : "unknown",
        count: Number(row.count),
        blocked: Number(row.blocked),
        percentage:
          totalQueriesCount > 0
            ? (Number(row.count) / totalQueriesCount) * 100
            : 0,
      })),
      totalCount,
    };
  }

  async getTopClients(
    options: LogScope & {
      range: TimeRange;
      limit?: number;
      offset: number;
      filter: "all" | "blocked";
    },
  ): Promise<{ items: TopClientEntry[]; totalCount: number }> {
    const filters = this.buildRangeFilters(options);

    const query = this.select(
      {
        client: this.columns.clientName,
        total: sql<number>`count(*)`,
        blocked: sql<number>`sum(case when ${this.columns.responseType} = 'BLOCKED' then 1 else 0 end)`,
        totalCount: sql<number>`count(*) over ()`,
        totalQueriesCount: sql<number>`sum(count(*)) over ()`,
      },
      this.getClientRankingIndexHints(options.range, options.filter),
    )
      .where(and(...filters))
      .groupBy(sql`${this.columns.clientName}`)
      .orderBy(
        desc(sql`count(*)`),
        asc(this.getTextSortExpression(this.columns.clientName)),
        asc(this.columns.clientName),
      );
    const result = await (options.limit === undefined
      ? query
      : query.limit(options.limit).offset(options.offset));

    const { totalQueriesCount, totalCount } = await this.resolveGroupedTotals({
      row: result[0],
      offset: options.offset,
      filters,
      groupColumn: this.columns.clientName,
    });

    return {
      items: result.map((row) => ({
        client: typeof row.client === "string" ? row.client : "unknown",
        total: Number(row.total),
        blocked: Number(row.blocked),
        percentage:
          totalQueriesCount > 0
            ? (Number(row.total) / totalQueriesCount) * 100
            : 0,
      })),
      totalCount,
    };
  }

  async getQueryTypesBreakdown(
    range: TimeRange,
    scope: LogScope = {},
  ): Promise<QueryTypeEntry[]> {
    const { startTime } = getTimeRangeConfig(range);

    const totalResult = await this.select({
      count: sql<number>`count(*)`,
    }).where(
      and(
        gte(this.columns.requestTs, this.formatDateTimeForFilter(startTime)),
        ...this.scopeFilters(scope),
      ),
    );
    const totalCount = Number(totalResult[0]?.count ?? 0);

    const result = await this.select({
      type: this.columns.questionType,
      count: sql<number>`count(*)`,
    })
      .where(
        and(
          gte(this.columns.requestTs, this.formatDateTimeForFilter(startTime)),
          ...this.scopeFilters(scope),
        ),
      )
      .groupBy(sql`${this.columns.questionType}`)
      .orderBy(
        desc(sql`count(*)`),
        asc(this.getTextSortExpression(this.columns.questionType)),
        asc(this.columns.questionType),
      );

    return result.map((row) => ({
      type: typeof row.type === "string" ? row.type : "unknown",
      count: Number(row.count),
      percentage: totalCount > 0 ? (Number(row.count) / totalCount) * 100 : 0,
    }));
  }
}

/**
 * Fills in missing time buckets with zero values.
 */
function fillTimeBuckets(
  data: Record<string, unknown>[],
  startTime: Date,
  interval: number,
  range: TimeRange,
): QueriesOverTimeEntry[] {
  const dataMap = new Map(data.map((d) => [d.timeBucket, d]));
  const results: QueriesOverTimeEntry[] = [];
  const now = Date.now();
  let current = Math.floor(startTime.getTime() / interval) * interval;

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
function formatDateForRange(date: Date, range: TimeRange): string {
  const { year, month, day, hours } = getUtcDateParts(date);

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

    default:
      throw new Error(`Unexpected value: ${range satisfies never}`);
  }
}
