import { normalizeLogTimestamp } from "~/server/logs/timestamp";
import { isEntryInScope } from "~/server/logs/scope";
import * as fs from "fs";
import Papa from "papaparse";
import { parse } from "csv-parse";
import { parse as parseSync } from "csv-parse/sync";
import { pipeline } from "node:stream/promises";
import { z } from "zod";
import { type LogEntry, type QueryLogsOptions } from "~/server/logs/types";

const CSV_OPTIONS = {
  delimiter: "\t",
  relax_column_count: true,
  relax_quotes: true,
  skip_empty_lines: true,
  skip_records_with_error: true,
};
const recordPositionsSchema = z.array(
  z.object({ info: z.object({ bytes: z.number() }) }),
);

async function detectNewline(filePath: string, size: number) {
  const handle = await fs.promises.open(filePath, "r");
  try {
    const buffer = Buffer.alloc(Math.min(size, 64 * 1024));
    const { bytesRead } = await handle.read(buffer);
    const records: unknown = parseSync(buffer.subarray(0, bytesRead), {
      ...CSV_OPTIONS,
      info: true,
      to: 1,
    });
    const end = recordPositionsSchema.parse(records)[0]?.info.bytes;
    if (!end || end >= bytesRead) {
      return undefined;
    }
    if (buffer[end - 1] === 10) {
      return buffer[end - 2] === 13 ? "\r\n" : "\n";
    }
    if (buffer[end - 1] === 13) {
      return "\r";
    }
    return undefined;
  } finally {
    await handle.close();
  }
}

function parseLogFields(value: unknown): LogEntry | null {
  if (
    !Array.isArray(value) ||
    value.length < 11 ||
    !value.every((field: unknown) => typeof field === "string")
  ) {
    return null;
  }

  const fields = value;
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

export async function scanEntries(
  filePath: string,
  visit: (entry: LogEntry) => void,
  size: number,
): Promise<void> {
  if (size === 0) {
    return;
  }

  function visitFields(fields: unknown) {
    const entry = parseLogFields(fields);
    if (entry) {
      visit(entry);
    }
  }
  const newline = await detectNewline(filePath, size);
  const stream = fs.createReadStream(filePath, {
    encoding: "utf8",
    highWaterMark: 64 * 1024,
    end: size - 1,
  });
  if (!newline) {
    await pipeline(
      stream,
      parse(CSV_OPTIONS),
      async (records: AsyncIterable<unknown>) => {
        for await (const fields of records) {
          visitFields(fields);
        }
      },
    );
    return;
  }
  try {
    await new Promise<void>((resolve, reject) => {
      Papa.parse<unknown>(stream, {
        delimiter: "\t",
        newline,
        skipEmptyLines: true,
        step({ data, errors }) {
          if (errors.length > 0) {
            return;
          }
          visitFields(data);
        },
        complete: () => resolve(),
        error: reject,
      });
    });
  } finally {
    stream.destroy();
  }
}

export async function streamAndParseEntries(
  filePath: string,
  filterFn?: (entry: LogEntry) => boolean,
): Promise<LogEntry[]> {
  const entries: LogEntry[] = [];
  const { size } = await fs.promises.stat(filePath);
  await scanEntries(
    filePath,
    (entry) => {
      if (!filterFn || filterFn(entry)) {
        entries.push(entry);
      }
    },
    size,
  );
  return entries;
}

export function createFilterFn(
  options: Pick<
    QueryLogsOptions,
    | "search"
    | "domain"
    | "responseType"
    | "client"
    | "questionType"
    | "excludedHostnames"
  >,
): (entry: LogEntry) => boolean {
  const searchLower = options.search?.toLowerCase();
  const domainLower = options.domain?.toLowerCase();
  const clientLower = options.client?.toLowerCase();

  return (entry: LogEntry): boolean => {
    if (!isEntryInScope(entry, options)) {
      return false;
    }
    const passesSearch =
      !searchLower ||
      entry.questionName?.toLowerCase().includes(searchLower) === true;
    const passesDomain =
      !domainLower || entry.questionName?.toLowerCase() === domainLower;
    const passesResponseType =
      !options.responseType || entry.responseType === options.responseType;
    const passesClient =
      !clientLower ||
      entry.clientName?.toLowerCase().includes(clientLower) === true;
    const passesQuestionType =
      !options.questionType || entry.questionType === options.questionType;
    return (
      passesSearch &&
      passesDomain &&
      passesResponseType &&
      passesClient &&
      passesQuestionType
    );
  };
}
