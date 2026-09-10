import { normalizeLogTimestamp } from "~/server/logs/timestamp";
import { isEntryInScope } from "~/server/logs/scope";
import * as fs from "fs";
import { pipeline } from "node:stream/promises";
import { parse } from "csv-parse";
import { z } from "zod";
import { type LogEntry, type QueryLogsOptions } from "~/server/logs/types";

const fieldsSchema = z.array(z.string()).min(11);

function parseLogFields(value: unknown): LogEntry | null {
  const parsed = fieldsSchema.safeParse(value);

  if (!parsed.success) {
    return null;
  }

  const fields = parsed.data;
  const parsedDuration = fields[3] ? parseInt(fields[3], 10) : NaN;

  return {
    requestTs: normalizeLogTimestamp(fields[0] || null, "local"),
    clientIp: fields[1] || null,
    clientName: fields[2] || null,
    durationMs: Number.isNaN(parsedDuration) ? null : parsedDuration,
    reason: fields[4] || null,
    questionName: fields[5] || null,
    answer: fields[6] || null,
    responseCode: fields[7] || null,
    responseType: fields[8] || null,
    questionType: fields[9] || null,
    hostname: fields[10] || null,
    effectiveTldp: null,
    id: null,
  };
}

export async function streamAndParseEntries(
  filePath: string,
  filterFn?: (entry: LogEntry) => boolean,
): Promise<LogEntry[]> {
  const entries: LogEntry[] = [];

  await pipeline(
    fs.createReadStream(filePath, { highWaterMark: 64 * 1024 }),
    parse({
      delimiter: "\t",
      relax_column_count: true,
      relax_quotes: true,
      skip_empty_lines: true,
      skip_records_with_error: true,
    }),
    async (records: AsyncIterable<unknown>) => {
      for await (const fields of records) {
        const entry = parseLogFields(fields);

        if (entry && (!filterFn || filterFn(entry))) {
          entries.push(entry);
        }
      }
    },
  );

  return entries;
}

export function createFilterFn(
  options: Pick<
    QueryLogsOptions,
    "search" | "responseType" | "client" | "questionType" | "excludedHostnames"
  >,
): (entry: LogEntry) => boolean {
  const searchLower = options.search?.toLowerCase();
  const clientLower = options.client?.toLowerCase();

  return (entry: LogEntry): boolean => {
    if (!isEntryInScope(entry, options)) {
      return false;
    }
    const passesSearch =
      !searchLower ||
      entry.questionName?.toLowerCase().includes(searchLower) === true;
    const passesResponseType =
      !options.responseType || entry.responseType === options.responseType;
    const passesClient =
      !clientLower ||
      entry.clientName?.toLowerCase().includes(clientLower) === true;
    const passesQuestionType =
      !options.questionType || entry.questionType === options.questionType;
    return (
      passesSearch && passesResponseType && passesClient && passesQuestionType
    );
  };
}

export function createTimeFilter(since: Date): (entry: LogEntry) => boolean {
  return (entry: LogEntry): boolean => {
    if (!entry.requestTs) {
      return false;
    }
    return new Date(entry.requestTs) >= since;
  };
}
