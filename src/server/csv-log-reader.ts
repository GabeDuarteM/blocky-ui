import * as fs from "fs";
import * as path from "path";
import { promisify } from "util";

const readdir = promisify(fs.readdir);
const stat = promisify(fs.stat);
const readFile = promisify(fs.readFile);

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
  id: number;
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

    const files = await readdir(directory);
    const logFiles = files.filter((file) => file.endsWith(".log"));

    if (logFiles.length === 0) {
      console.error(`No .log files found in directory: ${directory}`);
      return null;
    }

    let latestFile: string | null = null;
    let latestMtime = 0;

    for (const file of logFiles) {
      const filePath = path.join(directory, file);
      const stats = await stat(filePath);

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
 * Parse a tab-separated log line into a LogEntry object
 */
export function parseLogLine(line: string, id: number): LogEntry | null {
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
      id,
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
    };
  } catch (error) {
    console.error(`Error parsing log line:`, error);
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

    const content = await readFile(filePath, "utf-8");
    const lines = content.split("\n");

    // Parse all lines
    const allEntries: LogEntry[] = [];
    let lineId = 1;

    for (const line of lines) {
      const entry = parseLogLine(line, lineId);
      if (entry) {
        allEntries.push(entry);
        lineId++;
      }
    }

    // Sort by timestamp descending (most recent first)
    allEntries.sort((a, b) => {
      const dateA = a.requestTs ? new Date(a.requestTs).getTime() : 0;
      const dateB = b.requestTs ? new Date(b.requestTs).getTime() : 0;
      return dateB - dateA;
    });

    // Apply filters
    let filteredEntries = allEntries;

    if (options.search) {
      const searchLower = options.search.toLowerCase();
      filteredEntries = filteredEntries.filter((entry) =>
        entry.questionName?.toLowerCase().includes(searchLower),
      );
    }

    if (options.responseType) {
      filteredEntries = filteredEntries.filter(
        (entry) => entry.responseType === options.responseType,
      );
    }

    const totalCount = filteredEntries.length;

    // Apply pagination
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

/**
 * File watcher class for monitoring log file changes
 */
export class LogFileWatcher {
  private filePath: string;
  private callback: (newEntries: LogEntry[]) => void;
  private lastSize: number = 0;
  private intervalId: NodeJS.Timeout | null = null;
  private pollInterval: number;
  private lastLineId: number = 0;

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
      // Initialize with current file size
      const stats = await stat(this.filePath);
      this.lastSize = stats.size;

      // Count existing lines to set initial line ID
      const content = await readFile(this.filePath, "utf-8");
      const lines = content.split("\n").filter((line) => line.trim());
      this.lastLineId = lines.length;

      // Start polling
      this.intervalId = setInterval(
        // eslint-disable-next-line @typescript-eslint/no-misused-promises
        () => this.checkForChanges(),
        this.pollInterval,
      );
    } catch (error) {
      console.error(`Error starting file watcher:`, error);
    }
  }

  private async checkForChanges(): Promise<void> {
    try {
      const stats = await stat(this.filePath);

      if (stats.size > this.lastSize) {
        // File has grown, read new content
        const content = await readFile(this.filePath, "utf-8");
        const lines = content.split("\n");

        // Get only new lines
        const newLines = lines.slice(this.lastLineId);
        const newEntries: LogEntry[] = [];

        for (const line of newLines) {
          if (line.trim()) {
            this.lastLineId++;
            const entry = parseLogLine(line, this.lastLineId);
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
        // File was truncated or rotated, reset
        this.lastSize = stats.size;
        this.lastLineId = 0;
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
    this.lastLineId = 0;

    try {
      const stats = await stat(this.filePath);
      this.lastSize = stats.size;

      const content = await readFile(this.filePath, "utf-8");
      const lines = content.split("\n").filter((line) => line.trim());
      this.lastLineId = lines.length;
    } catch (error) {
      console.error(`Error switching to new file:`, error);
    }
  }
}
