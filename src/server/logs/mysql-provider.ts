import { desc, sql, and, eq, gte } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import type { MySql2Database } from "drizzle-orm/mysql2";
import { createPool } from "mysql2/promise";

import { logEntries } from "~/server/logs/mysql-schema";
import { type TimeRange } from "~/lib/constants";
import { getTimeRangeConfig } from "./aggregation-utils";
import type {
  LogProvider,
  LogEntry,
  StatsResult,
  QueriesOverTimeEntry,
  TopDomainEntry,
  TopClientEntry,
  QueryTypeEntry,
} from "./types";

const schema = { logEntries };

type DbType = MySql2Database<typeof schema>;

export class MySQLLogProvider implements LogProvider {
  private readonly db: DbType;

  constructor(options: { connectionUri: string }) {
    const conn = createPool({ uri: options.connectionUri });
    this.db = drizzle(conn, { schema, mode: "default" });
  }

  async getQueryLogs(options: {
    limit: number;
    offset: number;
    search?: string;
    responseType?: string;
  }): Promise<{ items: LogEntry[]; totalCount: number }> {
    const filters = [];

    if (options.search) {
      filters.push(
        sql`LOWER(${logEntries.questionName}) LIKE LOWER(${`%${options.search}%`})`,
      );
    }

    if (options.responseType) {
      filters.push(eq(logEntries.responseType, options.responseType));
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
      items: logs,
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

  async getQueriesOverTime(range: TimeRange): Promise<QueriesOverTimeEntry[]> {
    const { startTime, interval } = getTimeRangeConfig(range);
    const bucketExpr = getMysqlBucketExpression(range);

    const result = await this.db
      .select({
        timeBucket: sql<string>`${bucketExpr}`,
        total: sql<number>`count(*)`,
        blocked: sql<number>`sum(case when ${logEntries.responseType} = 'BLOCKED' then 1 else 0 end)`,
        cached: sql<number>`sum(case when ${logEntries.responseType} = 'CACHED' then 1 else 0 end)`,
      })
      .from(logEntries)
      .where(gte(logEntries.requestTs, startTime.toISOString()))
      .groupBy(sql`${bucketExpr}`)
      .orderBy(sql`${bucketExpr}`);

    return fillTimeBuckets(result, startTime, interval, range);
  }

  async getTopDomains(options: {
    range: TimeRange;
    limit: number;
    filter: "all" | "blocked";
  }): Promise<TopDomainEntry[]> {
    const { startTime } = getTimeRangeConfig(options.range);

    const filters = [gte(logEntries.requestTs, startTime.toISOString())];
    if (options.filter === "blocked") {
      filters.push(eq(logEntries.responseType, "BLOCKED"));
    }

    const totalResult = await this.db
      .select({ count: sql<number>`count(*)` })
      .from(logEntries)
      .where(and(...filters));
    const totalCount = Number(totalResult[0]?.count ?? 0);

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
      .limit(options.limit);

    return result.map((row) => ({
      domain: row.domain ?? "unknown",
      count: Number(row.count),
      blocked: Number(row.blocked),
      percentage: totalCount > 0 ? (Number(row.count) / totalCount) * 100 : 0,
    }));
  }

  async getTopClients(options: {
    range: TimeRange;
    limit: number;
  }): Promise<TopClientEntry[]> {
    const { startTime } = getTimeRangeConfig(options.range);

    const totalResult = await this.db
      .select({ count: sql<number>`count(*)` })
      .from(logEntries)
      .where(gte(logEntries.requestTs, startTime.toISOString()));
    const totalCount = Number(totalResult[0]?.count ?? 0);

    const result = await this.db
      .select({
        client: logEntries.clientName,
        total: sql<number>`count(*)`,
        blocked: sql<number>`sum(case when ${logEntries.responseType} = 'BLOCKED' then 1 else 0 end)`,
      })
      .from(logEntries)
      .where(gte(logEntries.requestTs, startTime.toISOString()))
      .groupBy(logEntries.clientName)
      .orderBy(desc(sql`count(*)`))
      .limit(options.limit);

    return result.map((row) => ({
      client: row.client ?? "unknown",
      total: Number(row.total),
      blocked: Number(row.blocked),
      percentage: totalCount > 0 ? (Number(row.total) / totalCount) * 100 : 0,
    }));
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
}

/**
 * Returns a raw SQL expression that buckets timestamps according to the range.
 * Uses UTC to ensure consistency with JavaScript's fillTimeBuckets iteration.
 */
function getMysqlBucketExpression(range: TimeRange) {
  const col = logEntries.requestTs.name;
  // Convert to UTC for consistent bucketing regardless of server timezone
  const utcCol = `CONVERT_TZ(${col}, @@session.time_zone, '+00:00')`;

  switch (range) {
    case "1h":
      // Round to 5-minute intervals in UTC
      return sql.raw(
        `CONCAT(DATE_FORMAT(${utcCol}, '%Y-%m-%d %H:'), LPAD(FLOOR(MINUTE(${utcCol})/5)*5, 2, '0'))`,
      );
    case "24h":
      // Round to hourly intervals in UTC
      return sql.raw(`DATE_FORMAT(${utcCol}, '%Y-%m-%d %H:00')`);
    case "7d":
      // Round to 6-hour intervals (0, 6, 12, 18) in UTC
      return sql.raw(
        `CONCAT(DATE_FORMAT(${utcCol}, '%Y-%m-%d '), LPAD(FLOOR(HOUR(${utcCol})/6)*6, 2, '0'), ':00')`,
      );
    case "30d":
      // Round to daily intervals in UTC
      return sql.raw(`DATE_FORMAT(${utcCol}, '%Y-%m-%d')`);
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
