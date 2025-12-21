import { desc, sql, and, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import type { MySql2Database } from "drizzle-orm/mysql2";
import {
  mysqlTable,
  index,
  datetime,
  longtext,
  varchar,
  int,
  bigint,
} from "drizzle-orm/mysql-core";
import { createPool } from "mysql2/promise";
import type { LogProvider, LogEntry } from "./types";

const logEntries = mysqlTable(
  "log_entries",
  {
    requestTs: datetime("request_ts", { mode: "string", fsp: 3 }).default(
      "NULL",
    ),
    clientIp: longtext("client_ip").default("NULL"),
    clientName: varchar("client_name", { length: 191 }).default("NULL"),
    durationMs: bigint("duration_ms", { mode: "number" }).default(sql`NULL`),
    reason: longtext().default("NULL"),
    responseType: varchar("response_type", { length: 191 }).default("NULL"),
    questionType: longtext("question_type").default("NULL"),
    questionName: longtext("question_name").default("NULL"),
    effectiveTldp: longtext("effective_tldp").default("NULL"),
    answer: longtext().default("NULL"),
    responseCode: longtext("response_code").default("NULL"),
    hostname: longtext().default("NULL"),
    id: int().autoincrement().notNull(),
  },
  (table) => [
    index("idx_log_entries_request_ts").on(table.requestTs),
    index("idx_log_entries_client_name").on(table.clientName),
    index("idx_log_entries_response_type").on(table.responseType),
  ],
);

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
}
