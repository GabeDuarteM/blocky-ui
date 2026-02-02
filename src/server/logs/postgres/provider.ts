import { desc, sql, and, eq, gte } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import { logEntries } from "./schema";
import { type TimeRange } from "~/lib/constants";
import { getTimeRangeConfig } from "../aggregation-utils";
import type {
  LogProvider,
  StatsResult,
  QueriesOverTimeEntry,
  TopDomainEntry,
  TopClientEntry,
  QueryTypeEntry,
  SearchDomainEntry,
  SearchClientEntry,
  QueryLogsOptions,
  QueryLogsResult,
} from "../types";

const schema = { logEntries };

type DbType = PostgresJsDatabase<typeof schema>;

type SqlFilter = ReturnType<typeof eq>;

export class PostgreSQLLogProvider implements LogProvider {
  private readonly db: DbType;

  constructor(options: { connectionUri: string }) {
    const conn = postgres(options.connectionUri);
    this.db = drizzle(conn, { schema });
  }

  private buildFiltersAndGetTotalCount(options: {
    range: TimeRange;
    filter: "all" | "blocked";
  }): {
    filters: SqlFilter[];
    getTotalCount: () => Promise<number>;
  } {
    const { startTime } = getTimeRangeConfig(options.range);
    const filters: SqlFilter[] = [
      gte(logEntries.requestTs, startTime.toISOString()),
    ];
    if (options.filter === "blocked") {
      filters.push(eq(logEntries.responseType, "BLOCKED"));
    }

    const getTotalCount = async () => {
      const result = await this.db
        .select({ count: sql<number>`count(*)` })
        .from(logEntries)
        .where(and(...filters));
      return Number(result[0]?.count ?? 0);
    };

    return { filters, getTotalCount };
  }

  async getQueryLogs(options: QueryLogsOptions): Promise<QueryLogsResult> {
    const filters = [];

    if (options.search) {
      filters.push(
        sql`LOWER(${logEntries.questionName}) LIKE LOWER(${`%${options.search}%`})`,
      );
    }

    if (options.responseType) {
      filters.push(eq(logEntries.responseType, options.responseType));
    }

    if (options.client) {
      filters.push(
        sql`LOWER(${logEntries.clientName}) LIKE LOWER(${`%${options.client}%`})`,
      );
    }

    if (options.questionType) {
      filters.push(eq(logEntries.questionType, options.questionType));
    }

    const countQuery = this.db
      .select({ count: sql<number>`count(*)` })
      .from(logEntries)
      .where(filters.length > 0 ? and(...filters) : undefined);

    const countResult = await countQuery;
    const count = countResult?.[0]?.count ?? 0;

    const query = this.db
      .select()
      .from(logEntries)
      .orderBy(desc(logEntries.requestTs))
      .limit(options.limit)
      .offset(options.offset)
      .where(filters.length > 0 ? and(...filters) : undefined);

    const logs = await query;

    return {
      items: logs.map((log) => ({ ...log, id: null })),
      totalCount: Number(count),
    };
  }

  async getStats24h(): Promise<StatsResult> {
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const result = await this.db
      .select({
        totalQueries: sql<number>`count(*)`,
        blocked: sql<number>`sum(case when ${logEntries.responseType} = 'BLOCKED' then 1 else 0 end)`,
      })
      .from(logEntries)
      .where(gte(logEntries.requestTs, oneDayAgo.toISOString()));

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
    const bucketExpr = getPostgresBucketExpression(options.range);

    const filters = [gte(logEntries.requestTs, startTime.toISOString())];

    if (options.domain) {
      filters.push(
        sql`LOWER(${logEntries.questionName}) LIKE LOWER(${`%${options.domain}%`})`,
      );
    }

    if (options.client) {
      filters.push(
        sql`LOWER(${logEntries.clientName}) LIKE LOWER(${`%${options.client}%`})`,
      );
    }

    const result = await this.db
      .select({
        timeBucket: sql<string>`${bucketExpr}`,
        total: sql<number>`count(*)`,
        blocked: sql<number>`sum(case when ${logEntries.responseType} = 'BLOCKED' then 1 else 0 end)`,
        cached: sql<number>`sum(case when ${logEntries.responseType} = 'CACHED' then 1 else 0 end)`,
      })
      .from(logEntries)
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
        count: sql<number>`count(distinct ${logEntries.questionName})`,
      })
      .from(logEntries)
      .where(and(...filters));
    const totalCount = Number(uniqueDomainsResult[0]?.count ?? 0);

    const result = await this.db
      .select({
        domain: logEntries.questionName,
        count: sql<number>`count(*)`,
        blocked: sql<number>`sum(case when ${logEntries.responseType} = 'BLOCKED' then 1 else 0 end)`,
      })
      .from(logEntries)
      .where(and(...filters))
      .groupBy(logEntries.questionName)
      .orderBy(desc(sql`count(*)`))
      .limit(options.limit)
      .offset(options.offset);

    return {
      items: result.map((row) => ({
        domain: row.domain ?? "unknown",
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
      .select({ count: sql<number>`count(distinct ${logEntries.clientName})` })
      .from(logEntries)
      .where(and(...filters));
    const totalCount = Number(uniqueClientsResult[0]?.count ?? 0);

    const result = await this.db
      .select({
        client: logEntries.clientName,
        total: sql<number>`count(*)`,
        blocked: sql<number>`sum(case when ${logEntries.responseType} = 'BLOCKED' then 1 else 0 end)`,
      })
      .from(logEntries)
      .where(and(...filters))
      .groupBy(logEntries.clientName)
      .orderBy(desc(sql`count(*)`))
      .limit(options.limit)
      .offset(options.offset);

    return {
      items: result.map((row) => ({
        client: row.client ?? "unknown",
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

  async getQueryTypesBreakdown(range: TimeRange): Promise<QueryTypeEntry[]> {
    const { startTime } = getTimeRangeConfig(range);

    const totalResult = await this.db
      .select({ count: sql<number>`count(*)` })
      .from(logEntries)
      .where(gte(logEntries.requestTs, startTime.toISOString()));
    const totalCount = Number(totalResult[0]?.count ?? 0);

    const result = await this.db
      .select({
        type: logEntries.questionType,
        count: sql<number>`count(*)`,
      })
      .from(logEntries)
      .where(gte(logEntries.requestTs, startTime.toISOString()))
      .groupBy(logEntries.questionType)
      .orderBy(desc(sql`count(*)`));

    return result.map((row) => ({
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
        domain: logEntries.questionName,
        count: sql<number>`count(*)`,
      })
      .from(logEntries)
      .where(
        and(
          gte(logEntries.requestTs, startTime.toISOString()),
          sql`LOWER(${logEntries.questionName}) LIKE LOWER(${`%${options.query}%`})`,
        ),
      )
      .groupBy(logEntries.questionName)
      .orderBy(desc(sql`count(*)`))
      .limit(options.limit);

    return result.map((row) => ({
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
        client: logEntries.clientName,
        count: sql<number>`count(*)`,
      })
      .from(logEntries)
      .where(
        and(
          gte(logEntries.requestTs, startTime.toISOString()),
          sql`LOWER(${logEntries.clientName}) LIKE LOWER(${`%${options.query}%`})`,
        ),
      )
      .groupBy(logEntries.clientName)
      .orderBy(desc(sql`count(*)`))
      .limit(options.limit);

    return result.map((row) => ({
      client: row.client ?? "unknown",
      count: Number(row.count),
    }));
  }
}

/**
 * Returns a raw SQL expression that buckets timestamps according to the range.
 * Uses AT TIME ZONE 'UTC' for consistent bucketing.
 */
function getPostgresBucketExpression(range: TimeRange) {
  const col = logEntries.requestTs.name;

  switch (range) {
    case "1h":
      // Round to 5-minute intervals in UTC
      return sql.raw(
        `TO_CHAR(DATE_TRUNC('hour', ${col} AT TIME ZONE 'UTC') + INTERVAL '5 min' * FLOOR(EXTRACT(MINUTE FROM ${col} AT TIME ZONE 'UTC') / 5), 'YYYY-MM-DD HH24:MI')`,
      );
    case "24h":
      // Round to hourly intervals in UTC
      return sql.raw(
        `TO_CHAR(DATE_TRUNC('hour', ${col} AT TIME ZONE 'UTC'), 'YYYY-MM-DD HH24:00')`,
      );
    case "7d":
      // Round to 6-hour intervals (0, 6, 12, 18) in UTC
      return sql.raw(
        `TO_CHAR(DATE_TRUNC('day', ${col} AT TIME ZONE 'UTC') + INTERVAL '6 hours' * FLOOR(EXTRACT(HOUR FROM ${col} AT TIME ZONE 'UTC') / 6), 'YYYY-MM-DD HH24:00')`,
      );
    case "30d":
      // Round to daily intervals in UTC
      return sql.raw(
        `TO_CHAR(DATE_TRUNC('day', ${col} AT TIME ZONE 'UTC'), 'YYYY-MM-DD')`,
      );
  }
}

function fillTimeBuckets(
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

function formatDateForRange(date: Date, range: TimeRange): string {
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
