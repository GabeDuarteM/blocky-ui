import * as fs from "fs";
import * as readline from "readline";
import type { LogEntry, QueryLogsOptions } from "../types";

function parseLogLine(line: string): LogEntry | null {
  try {
    const trimmed = line.trim();
    if (!trimmed) return null;

    const fields = trimmed.split("\t");

    // Expected format: timestamp, clientIP, clientName, duration, reason, questionName, answer, responseCode, responseType, questionType, hostnameId
    if (fields.length < 11) {
      console.warn(
        `Malformed log line (expected 11+ fields, got ${fields.length}):`,
        line,
      );
      return null;
    }

    const parsedDuration = fields[3] ? parseInt(fields[3], 10) : NaN;

    return {
      requestTs: fields[0] || null,
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
  } catch (error) {
    console.error(`Error parsing log line:`, error);
    return null;
  }
}

export function streamAndParseEntries(
  filePath: string,
  filterFn?: (entry: LogEntry) => boolean,
): Promise<LogEntry[]> {
  return new Promise((resolve, reject) => {
    const entries: LogEntry[] = [];
    let rejected = false;

    const stream = fs.createReadStream(filePath, {
      encoding: "utf-8",
      highWaterMark: 64 * 1024, // 64KB chunks
    });

    const rl = readline.createInterface({
      input: stream,
      crlfDelay: Infinity,
    });

    const onError = (error: Error) => {
      if (rejected) return;
      rejected = true;
      reject(error);
    };

    rl.on("line", (line) => {
      const entry = parseLogLine(line);
      if (!entry) return;

      if (!filterFn || filterFn(entry)) {
        entries.push(entry);
      }
    });

    rl.on("close", () => {
      if (!rejected) {
        resolve(entries);
      }
    });

    rl.on("error", onError);
    stream.on("error", onError);
  });
}

export function createFilterFn(
  options: Pick<
    QueryLogsOptions,
    "search" | "responseType" | "client" | "questionType"
  >,
): (entry: LogEntry) => boolean {
  const searchLower = options.search?.toLowerCase();
  const clientLower = options.client?.toLowerCase();

  return (entry: LogEntry): boolean => {
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
    if (!entry.requestTs) return false;
    return new Date(entry.requestTs) >= since;
  };
}

export function computeStats(entries: LogEntry[]): {
  totalQueries: number;
  blocked: number;
} {
  const blocked = entries.filter((e) => e.responseType === "BLOCKED").length;
  return { totalQueries: entries.length, blocked };
}
