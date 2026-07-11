import { pgTable, index, timestamp, text, bigint } from "drizzle-orm/pg-core";

import { createLogEntryColumns } from "~/server/logs/sql/schema";

export const logEntries = pgTable(
  "log_entries",
  createLogEntryColumns({
    requestTs: (name) =>
      timestamp(name, { mode: "string", withTimezone: true }),
    text: (name) => text(name),
    durationMs: (name) => bigint(name, { mode: "number" }),
  }),
  (table) => [
    index("idx_log_entries_request_ts").on(table.requestTs),
    index("idx_log_entries_client_name").on(table.clientName),
    index("idx_log_entries_response_type").on(table.responseType),
  ],
);
