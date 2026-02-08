import { sql, type SQL } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { createPool } from "mysql2/promise";

import { logEntries } from "~/server/logs/mysql/schema";
import { type TimeRange } from "~/lib/constants";
import { BaseSqlLogProvider } from "~/server/logs/sql/base-provider";

export class MySQLLogProvider extends BaseSqlLogProvider {
  private readonly pool: ReturnType<typeof createPool>;

  constructor(options: { connectionUri: string }) {
    const pool = createPool({
      uri: options.connectionUri,
      timezone: "+00:00",
    });
    const db = drizzle(pool, { schema: { logEntries }, mode: "default" });

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

    this.pool = pool;
  }

  async close(): Promise<void> {
    await this.pool.end();
  }

  protected getBucketExpression(range: TimeRange): SQL {
    const col = logEntries.requestTs.name;

    switch (range) {
      case "1h":
        // Round to 5-minute intervals
        return sql.raw(
          `CONCAT(DATE_FORMAT(${col}, '%Y-%m-%d %H:'), LPAD(FLOOR(MINUTE(${col})/5)*5, 2, '0'))`,
        );
      case "24h":
        // Round to hourly intervals
        return sql.raw(`DATE_FORMAT(${col}, '%Y-%m-%d %H:00')`);
      case "7d":
        // Round to 6-hour intervals (0, 6, 12, 18)
        return sql.raw(
          `CONCAT(DATE_FORMAT(${col}, '%Y-%m-%d '), LPAD(FLOOR(HOUR(${col})/6)*6, 2, '0'), ':00')`,
        );
      case "30d":
        // Round to daily intervals
        return sql.raw(`DATE_FORMAT(${col}, '%Y-%m-%d')`);
    }
  }
}
