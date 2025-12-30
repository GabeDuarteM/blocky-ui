import * as fs from "fs";
import * as readline from "readline";
import type { LogEntry } from "../types";

export function parseLogLine(line: string): LogEntry | null {
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

    const stream = fs.createReadStream(filePath, {
      encoding: "utf-8",
      highWaterMark: 64 * 1024, // 64KB chunks
    });

    const rl = readline.createInterface({
      input: stream,
      crlfDelay: Infinity,
    });

    rl.on("line", (line) => {
      const entry = parseLogLine(line);
      if (!entry) return;

      if (!filterFn || filterFn(entry)) {
        entries.push(entry);
      }
    });

    rl.on("close", () => {
      resolve(entries);
    });

    stream.on("error", (error) => {
      reject(error);
    });
  });
}

export function createFilterFn(options: {
  search?: string;
  responseType?: string;
}): (entry: LogEntry) => boolean {
  const searchLower = options.search?.toLowerCase();

  return (entry: LogEntry): boolean => {
    const passesSearch =
      !searchLower ||
      entry.questionName?.toLowerCase().includes(searchLower) === true;
    const passesType =
      !options.responseType || entry.responseType === options.responseType;
    return passesSearch && passesType;
  };
}
