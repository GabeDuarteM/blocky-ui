import { sql, type SQL } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { createPool } from "mysql2/promise";

import { logEntries } from "~/server/logs/mysql/schema";
import { type TimeRange } from "~/lib/constants";
import { BaseSqlLogProvider } from "~/server/logs/sql/base-provider";

export class MySQLLogProvider extends BaseSqlLogProvider {
  constructor(options: { connectionUri: string }) {
    const conn = createPool({ uri: options.connectionUri });
    const db = drizzle(conn, { schema: { logEntries }, mode: "default" });

    super({
      db,
      table: logEntries,
      columns: {
        id: logEntries.id,
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
}
