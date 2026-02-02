import { pgTable, index, timestamp, text, bigint } from "drizzle-orm/pg-core";

export const logEntries = pgTable(
  "log_entries",
  {
    requestTs: timestamp("request_ts", { mode: "string", withTimezone: true }),
    clientIp: text("client_ip"),
    clientName: text("client_name"),
    durationMs: bigint("duration_ms", { mode: "number" }),
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
