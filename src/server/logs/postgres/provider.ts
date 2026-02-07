import { sql, type SQL } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import { logEntries } from "~/server/logs/postgres/schema";
import { type TimeRange } from "~/lib/constants";
import { BaseSqlLogProvider } from "~/server/logs/sql/base-provider";

export class PostgreSQLLogProvider extends BaseSqlLogProvider {
  constructor(options: { connectionUri: string }) {
    const conn = postgres(options.connectionUri, {
      connection: {
        timezone: "UTC",
      },
    });
    const db = drizzle(conn, { schema: { logEntries } });

    super({
      db,
      table: logEntries,
      columns: {
        requestTs: logEntries.requestTs,
        clientIp: logEntries.clientIp,
        clientName: logEntries.clientName,
        durationMs: logEntries.durationMs,
        reason: logEntries.reason,
        responseType: logEntries.responseType,
        questionType: logEntries.questionType,
        questionName: logEntries.questionName,
        effectiveTldp: logEntries.effectiveTldp,
        answer: logEntries.answer,
        responseCode: logEntries.responseCode,
        hostname: logEntries.hostname,
      },
    });
  }

  protected getBucketExpression(range: TimeRange): SQL {
    const col = logEntries.requestTs.name;

    switch (range) {
      case "1h":
        // Round to 5-minute intervals
        return sql.raw(
          `TO_CHAR(DATE_TRUNC('hour', ${col}) + INTERVAL '5 min' * FLOOR(EXTRACT(MINUTE FROM ${col}) / 5), 'YYYY-MM-DD HH24:MI')`,
        );
      case "24h":
        // Round to hourly intervals
        return sql.raw(
          `TO_CHAR(DATE_TRUNC('hour', ${col}), 'YYYY-MM-DD HH24:00')`,
        );
      case "7d":
        // Round to 6-hour intervals (0, 6, 12, 18)
        return sql.raw(
          `TO_CHAR(DATE_TRUNC('day', ${col}) + INTERVAL '6 hours' * FLOOR(EXTRACT(HOUR FROM ${col}) / 6), 'YYYY-MM-DD HH24:00')`,
        );
      case "30d":
        // Round to daily intervals
        return sql.raw(`TO_CHAR(DATE_TRUNC('day', ${col}), 'YYYY-MM-DD')`);
    }
  }
}
