import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

import { createLogEntryColumns } from "~/server/logs/sql/schema";

export const logEntries = sqliteTable(
  "log_entries",
  createLogEntryColumns({
    requestTs: (name) => text(name),
    text: (name) => text(name),
    durationMs: (name) => integer(name),
  }),
  (table) => [
    index("idx_log_entries_request_ts").on(table.requestTs),
    index("idx_log_entries_client_name").on(table.clientName),
    index("idx_log_entries_response_type").on(table.responseType),
  ],
);
