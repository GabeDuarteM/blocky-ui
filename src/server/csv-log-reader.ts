import * as fs from "fs";
import * as path from "path";

export interface LogEntry {
  requestTs: string | null;
  clientIp: string | null;
  clientName: string | null;
  durationMs: number | null;
  reason: string | null;
  questionName: string | null;
  answer: string | null;
  responseCode: string | null;
  responseType: string | null;
  questionType: string | null;
  hostname: string | null;
  effectiveTldp: string | null;
  id: number | null;
}

/**
 * Parse a tab-separated log line into a LogEntry object
 */
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
      responseType: fields[8] || null, // This is the response type we want to use
      questionType: fields[9] || null,
      hostname: fields[10] || null, // Using the hostname ID as hostname
      effectiveTldp: null, // Not available in CSV format
      id: null, // Not available in CSV format
    };
  } catch (error) {
    console.error(`Error parsing log line:`, error);
    return null;
  }
}

/**
 * Find the most recently modified .log file in a directory
 */
export async function findLatestLogFile(
  directory: string,
): Promise<string | null> {
  try {
    if (!fs.existsSync(directory)) {
      console.error(`Directory not found: ${directory}`);
      return null;
    }

    const files = await fs.promises.readdir(directory);
    const logFiles = files.filter((file) => file.endsWith(".log"));

    if (logFiles.length === 0) {
      console.error(`No .log files found in directory: ${directory}`);
      return null;
    }

    let latestFile: string | null = null;
    let latestMtime = 0;

    for (const file of logFiles) {
      const filePath = path.join(directory, file);
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

/**
 * Read and parse a log file with filtering and pagination
 */
export async function readLogFile(
  filePath: string,
  options: {
    limit: number;
    offset: number;
    search?: string;
    responseType?: string;
  },
): Promise<{ items: LogEntry[]; totalCount: number }> {
  try {
    if (!fs.existsSync(filePath)) {
      console.error(`Log file not found: ${filePath}`);
      return { items: [], totalCount: 0 };
    }

    return await streamAndParseLogFile(filePath, options);
  } catch (error) {
    console.error(`Error reading log file:`, error);
    return { items: [], totalCount: 0 };
  }
}

/**
 * Stream and parse log file efficiently without loading entire file into memory
 * Applies filtering during parsing and collects entries for sorting
 */
async function streamAndParseLogFile(
  filePath: string,
  options: {
    limit: number;
    offset: number;
    search?: string;
    responseType?: string;
  },
): Promise<{ items: LogEntry[]; totalCount: number }> {
  return new Promise((resolve, reject) => {
    const filteredEntries: LogEntry[] = [];
    let buffer = "";

    const searchLower = options.search?.toLowerCase();

    const stream = fs.createReadStream(filePath, {
      encoding: "utf-8",
      highWaterMark: 64 * 1024, // 64KB chunks
    });

    stream.on("data", (chunk: string | Buffer) => {
      const str = typeof chunk === "string" ? chunk : chunk.toString("utf-8");
      buffer += str;

      // Process complete lines
      const lines = buffer.split("\n");
      // Keep the last incomplete line in buffer
      buffer = lines.pop() || "";

      for (const line of lines) {
        if (!line.trim()) continue;

        const entry = parseLogLine(line);
        if (!entry) continue;

        // Apply filters during parsing (memory efficient)
        if (
          searchLower &&
          !entry.questionName?.toLowerCase().includes(searchLower)
        ) {
          continue;
        }

        if (
          options.responseType &&
          entry.responseType !== options.responseType
        ) {
          continue;
        }

        filteredEntries.push(entry);
      }
    });

    stream.on("end", () => {
      // Process last line if buffer has content
      if (buffer.trim()) {
        const entry = parseLogLine(buffer);
        if (entry) {
          // Apply filters
          const passesSearch =
            !searchLower ||
            entry.questionName?.toLowerCase().includes(searchLower);
          const passesType =
            !options.responseType ||
            entry.responseType === options.responseType;

          if (passesSearch && passesType) {
            filteredEntries.push(entry);
          }
        }
      }

      // Reverse to show most recent first
      filteredEntries.reverse();

      const totalCount = filteredEntries.length;
      const paginatedEntries = filteredEntries.slice(
        options.offset,
        options.offset + options.limit,
      );

      resolve({
        items: paginatedEntries,
        totalCount,
      });
    });

    stream.on("error", (error) => {
      reject(error);
    });
  });
}

/**
 * File watcher class for monitoring log file changes
 */
export class LogFileWatcher {
  private filePath: string;
  private lastSize: number = 0;
  private intervalId: NodeJS.Timeout | null = null;
  private pollInterval: number;
  private callback: (newEntries: LogEntry[]) => void;

  constructor(
    filePath: string,
    callback: (newEntries: LogEntry[]) => void,
    pollInterval: number = 5000,
  ) {
    this.filePath = filePath;
    this.callback = callback;
    this.pollInterval = pollInterval;
  }

  async start(): Promise<void> {
    try {
      const stats = await fs.promises.stat(this.filePath);
      this.lastSize = stats.size;

      this.intervalId = setInterval(
        // eslint-disable-next-line @typescript-eslint/no-misused-promises
        () => this.checkForChanges(),
        this.pollInterval,
      );
    } catch (error) {
      console.error(`Error starting file watcher:`, error);
    }
  }

  private async readNewContent(from: number, to: number): Promise<string> {
    if (to <= from) {
      return "";
    }

    return await new Promise<string>((resolve, reject) => {
      const stream = fs.createReadStream(this.filePath, {
        encoding: "utf-8",
        start: from,
        end: to - 1,
      });
      let data = "";
      stream.on("data", (chunk) => {
        data += chunk;
      });
      stream.on("error", (err) => {
        reject(err);
      });
      stream.on("end", () => {
        resolve(data);
      });
    });
  }

  private async checkForChanges(): Promise<void> {
    try {
      const stats = await fs.promises.stat(this.filePath);
      if (stats.size > this.lastSize) {
        // File has grown, read only new content
        const newContent = await this.readNewContent(this.lastSize, stats.size);
        const newLines = newContent.split("\n");
        const newEntries: LogEntry[] = [];

        for (const line of newLines) {
          if (line.trim()) {
            const entry = parseLogLine(line);
            if (entry) {
              newEntries.push(entry);
            }
          }
        }

        if (newEntries.length > 0) {
          this.callback(newEntries);
        }

        this.lastSize = stats.size;
      } else if (stats.size < this.lastSize) {
        // File was truncated or rotated; reinitialize watcher state
        await this.switchToFile(this.filePath);
      }
    } catch (error) {
      console.error(`Error checking for file changes:`, error);
    }
  }

  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  async switchToFile(newFilePath: string): Promise<void> {
    this.filePath = newFilePath;
    this.lastSize = 0;

    try {
      const stats = await fs.promises.stat(this.filePath);
      this.lastSize = stats.size;
    } catch (error) {
      console.error(`Error switching to new file:`, error);
    }
  }
}
