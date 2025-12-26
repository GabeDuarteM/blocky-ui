import {
  mysqlTable,
  index,
  datetime,
  longtext,
  varchar,
  int,
  bigint,
} from "drizzle-orm/mysql-core";
import { sql } from "drizzle-orm";

export const logEntries = mysqlTable(
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
