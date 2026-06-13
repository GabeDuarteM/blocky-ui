import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const logEntries = sqliteTable(
  "log_entries",
  {
    requestTs: text("request_ts"),
    clientIp: text("client_ip"),
    clientName: text("client_name"),
    durationMs: integer("duration_ms"),
    reason: text(),
    responseType: text("response_type"),
    questionType: text("question_type"),
    questionName: text("question_name"),
    effectiveTldp: text("effective_tldp"),
    answer: text(),
    responseCode: text("response_code"),
    hostname: text(),
  },
  (table) => [
    index("idx_log_entries_request_ts").on(table.requestTs),
    index("idx_log_entries_client_name").on(table.clientName),
    index("idx_log_entries_response_type").on(table.responseType),
  ],
);
