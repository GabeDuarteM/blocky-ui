import * as fs from "fs";
import * as path from "path";
import * as readline from "readline";
import type { LogProvider, LogEntry } from "./types";

/**
 * CSV file-based log provider
 * Reads directly from the latest log file on each request using buffered streaming
 */
export class CsvLogProvider implements LogProvider {
  private readonly directory: string;

  constructor(options: { directory: string }) {
    this.directory = options.directory;
  }

  async getQueryLogs(options: {
    limit: number;
    offset: number;
    search?: string;
    responseType?: string;
  }): Promise<{ items: LogEntry[]; totalCount: number }> {
    const logFile = await this.findLatestLogFile();

    if (!logFile) {
      return { items: [], totalCount: 0 };
    }

    return await this.readLogFile(logFile, options);
  }

  private async findLatestLogFile(): Promise<string | null> {
    try {
      if (!fs.existsSync(this.directory)) {
        console.error(`Directory not found: ${this.directory}`);
        return null;
      }

      const files = await fs.promises.readdir(this.directory);
      const logFiles = files.filter((file) => file.endsWith(".log"));

      if (logFiles.length === 0) {
        console.error(`No *.log files found in directory: ${this.directory}`);
        return null;
      }

      let latestFile: string | null = null;
      let latestMtime = 0;

      for (const file of logFiles) {
        const filePath = path.join(this.directory, file);
        const stats = await fs.promises.stat(filePath);

        if (stats.mtimeMs > latestMtime) {
          latestMtime = stats.mtimeMs;
          latestFile = filePath;
        }
      }

      return latestFile;
    } catch (error) {
      console.error(`Error finding latest log file:`, error);
      return null;
    }
  }

  private parseLogLine(line: string): LogEntry | null {
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

  private streamAndParseEntries(
    stream: fs.ReadStream,
    filterFn?: (entry: LogEntry) => boolean,
  ): Promise<LogEntry[]> {
    return new Promise((resolve, reject) => {
      const entries: LogEntry[] = [];

      const rl = readline.createInterface({
        input: stream,
        crlfDelay: Infinity,
      });

      rl.on("line", (line) => {
        const entry = this.parseLogLine(line);
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

  private async readLogFile(
    filePath: string,
    options: {
      limit: number;
      offset: number;
      search?: string;
      responseType?: string;
    },
  ): Promise<{ items: LogEntry[]; totalCount: number }> {
    try {
      const searchLower = options.search?.toLowerCase();

      const passesFilters = (entry: LogEntry): boolean => {
        const passesSearch =
          !searchLower ||
          entry.questionName?.toLowerCase().includes(searchLower) === true;
        const passesType =
          !options.responseType || entry.responseType === options.responseType;
        return passesSearch && passesType;
      };

      const stream = fs.createReadStream(filePath, {
        encoding: "utf-8",
        highWaterMark: 64 * 1024, // 64KB chunks
      });

      const filteredEntries = await this.streamAndParseEntries(
        stream,
        passesFilters,
      );
      filteredEntries.reverse(); // to show most recent first

      const totalCount = filteredEntries.length;
      const paginatedEntries = filteredEntries.slice(
        options.offset,
        options.offset + options.limit,
      );

      return {
        items: paginatedEntries,
        totalCount,
      };
    } catch (error) {
      console.error(`Error reading log file:`, error);
      return { items: [], totalCount: 0 };
    }
  }
}
