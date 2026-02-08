import { type TimeRange } from "~/lib/constants";
import { getTimeRangeConfig } from "~/server/logs/aggregation-utils";
import { type LogEntry } from "~/server/logs/types";

const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

interface EntryTemplate {
  offsetMs: number;
  clientIp: string;
  clientName: string | null;
  durationMs: number | null;
  reason: string;
  questionName: string | null;
  answer: string;
  responseType: string;
  questionType: string;
}

function buildEntry(template: EntryTemplate, now: number): LogEntry {
  return {
    requestTs: new Date(now - template.offsetMs).toISOString(),
    clientIp: template.clientIp,
    clientName: template.clientName,
    durationMs: template.durationMs,
    reason: template.reason,
    questionName: template.questionName,
    answer: template.answer,
    responseCode: "NOERROR",
    responseType: template.responseType,
    questionType: template.questionType,
    hostname: "blocky-instance-1",
    effectiveTldp: null,
    id: null,
  };
}

function createTemplates(): EntryTemplate[] {
  const last1h: EntryTemplate[] = [
    {
      offsetMs: 2 * MINUTE,
      clientIp: "192.168.1.10",
      clientName: "laptop",
      durationMs: 12,
      reason: "RESOLVED",
      questionName: "google.com",
      answer: "142.250.80.46",
      responseType: "RESOLVED",
      questionType: "A",
    },
    {
      offsetMs: 5 * MINUTE,
      clientIp: "192.168.1.20",
      clientName: "Phone",
      durationMs: 8,
      reason: "CACHED",
      questionName: "google.com",
      answer: "142.250.80.46",
      responseType: "CACHED",
      questionType: "A",
    },
    {
      offsetMs: 10 * MINUTE,
      clientIp: "192.168.1.10",
      clientName: "laptop",
      durationMs: 15,
      reason: "RESOLVED",
      questionName: "GitHub.com",
      answer: "140.82.121.3",
      responseType: "RESOLVED",
      questionType: "A",
    },
    {
      offsetMs: 15 * MINUTE,
      clientIp: "192.168.1.30",
      clientName: "server-01",
      durationMs: 3,
      reason: "BLOCKED (ads.list)",
      questionName: "blocked-site.com",
      answer: "0.0.0.0",
      responseType: "BLOCKED",
      questionType: "A",
    },
    {
      offsetMs: 20 * MINUTE,
      clientIp: "192.168.1.10",
      clientName: "laptop",
      durationMs: 22,
      reason: "RESOLVED",
      questionName: "example.org",
      answer: "93.184.216.34",
      responseType: "RESOLVED",
      questionType: "AAAA",
    },
    {
      offsetMs: 30 * MINUTE,
      clientIp: "192.168.1.20",
      clientName: "Phone",
      durationMs: 5,
      reason: "CACHED",
      questionName: "google.com",
      answer: "142.250.80.46",
      responseType: "CACHED",
      questionType: "A",
    },
    {
      offsetMs: 40 * MINUTE,
      clientIp: "192.168.1.10",
      clientName: "laptop",
      durationMs: null,
      reason: "RESOLVED",
      questionName: null,
      answer: "10.0.0.1",
      responseType: "RESOLVED",
      questionType: "A",
    },
    {
      offsetMs: 50 * MINUTE,
      clientIp: "192.168.1.10",
      clientName: "laptop",
      durationMs: 18,
      reason: "RESOLVED",
      questionName: "google.com",
      answer: "142.250.80.46",
      responseType: "RESOLVED",
      questionType: "AAAA",
    },
  ];

  const last24h: EntryTemplate[] = [
    {
      offsetMs: 2 * HOUR,
      clientIp: "192.168.1.10",
      clientName: "laptop",
      durationMs: 10,
      reason: "RESOLVED",
      questionName: "google.com",
      answer: "142.250.80.46",
      responseType: "RESOLVED",
      questionType: "A",
    },
    {
      offsetMs: 3 * HOUR,
      clientIp: "192.168.1.20",
      clientName: "Phone",
      durationMs: 14,
      reason: "RESOLVED",
      questionName: "GitHub.com",
      answer: "140.82.121.3",
      responseType: "RESOLVED",
      questionType: "A",
    },
    {
      offsetMs: 4 * HOUR,
      clientIp: "192.168.1.30",
      clientName: "server-01",
      durationMs: 2,
      reason: "BLOCKED (ads.list)",
      questionName: "blocked-site.com",
      answer: "0.0.0.0",
      responseType: "BLOCKED",
      questionType: "A",
    },
    {
      offsetMs: 5 * HOUR,
      clientIp: "192.168.1.10",
      clientName: "laptop",
      durationMs: 20,
      reason: "RESOLVED",
      questionName: "google.com",
      answer: "142.250.80.46",
      responseType: "RESOLVED",
      questionType: "AAAA",
    },
    {
      offsetMs: 6 * HOUR,
      clientIp: "192.168.1.20",
      clientName: "Phone",
      durationMs: 7,
      reason: "CACHED",
      questionName: "example.org",
      answer: "93.184.216.34",
      responseType: "CACHED",
      questionType: "A",
    },
    {
      offsetMs: 8 * HOUR,
      clientIp: "192.168.1.10",
      clientName: "laptop",
      durationMs: 11,
      reason: "RESOLVED",
      questionName: "GitHub.com",
      answer: "140.82.121.3",
      responseType: "RESOLVED",
      questionType: "CNAME",
    },
    {
      offsetMs: 10 * HOUR,
      clientIp: "192.168.1.40",
      clientName: null,
      durationMs: 9,
      reason: "RESOLVED",
      questionName: "rare-domain.net",
      answer: "203.0.113.50",
      responseType: "RESOLVED",
      questionType: "A",
    },
    {
      offsetMs: 12 * HOUR,
      clientIp: "192.168.1.10",
      clientName: "laptop",
      durationMs: 16,
      reason: "RESOLVED",
      questionName: "google.com",
      answer: "142.250.80.46",
      responseType: "RESOLVED",
      questionType: "A",
    },
    {
      offsetMs: 14 * HOUR,
      clientIp: "192.168.1.20",
      clientName: "Phone",
      durationMs: null,
      reason: "BLOCKED (malware.list)",
      questionName: "blocked-site.com",
      answer: "0.0.0.0",
      responseType: "BLOCKED",
      questionType: "A",
    },
    {
      offsetMs: 16 * HOUR,
      clientIp: "192.168.1.10",
      clientName: "laptop",
      durationMs: 6,
      reason: "RESOLVED",
      questionName: "GitHub.com",
      answer: "140.82.121.3",
      responseType: "RESOLVED",
      questionType: "A",
    },
    {
      offsetMs: 20 * HOUR,
      clientIp: "192.168.1.30",
      clientName: "server-01",
      durationMs: 4,
      reason: "CACHED",
      questionName: "google.com",
      answer: "142.250.80.46",
      responseType: "CACHED",
      questionType: "A",
    },
    {
      offsetMs: 22 * HOUR,
      clientIp: "192.168.1.40",
      clientName: null,
      durationMs: 13,
      reason: "RESOLVED",
      questionName: null,
      answer: "10.0.0.2",
      responseType: "RESOLVED",
      questionType: "AAAA",
    },
  ];

  const last7d: EntryTemplate[] = [
    {
      offsetMs: 2 * DAY,
      clientIp: "192.168.1.10",
      clientName: "laptop",
      durationMs: 19,
      reason: "RESOLVED",
      questionName: "google.com",
      answer: "142.250.80.46",
      responseType: "RESOLVED",
      questionType: "A",
    },
    {
      offsetMs: 2 * DAY + 6 * HOUR,
      clientIp: "192.168.1.20",
      clientName: "Phone",
      durationMs: 25,
      reason: "RESOLVED",
      questionName: "GitHub.com",
      answer: "140.82.121.3",
      responseType: "RESOLVED",
      questionType: "AAAA",
    },
    {
      offsetMs: 3 * DAY,
      clientIp: "192.168.1.10",
      clientName: "laptop",
      durationMs: 3,
      reason: "BLOCKED (ads.list)",
      questionName: "blocked-site.com",
      answer: "0.0.0.0",
      responseType: "BLOCKED",
      questionType: "A",
    },
    {
      offsetMs: 3 * DAY + 12 * HOUR,
      clientIp: "192.168.1.30",
      clientName: "server-01",
      durationMs: 8,
      reason: "RESOLVED",
      questionName: "example.org",
      answer: "93.184.216.34",
      responseType: "RESOLVED",
      questionType: "A",
    },
    {
      offsetMs: 4 * DAY,
      clientIp: "192.168.1.10",
      clientName: "laptop",
      durationMs: 11,
      reason: "RESOLVED",
      questionName: "rare-domain.net",
      answer: "203.0.113.50",
      responseType: "RESOLVED",
      questionType: "CNAME",
    },
    {
      offsetMs: 4 * DAY + 8 * HOUR,
      clientIp: "192.168.1.20",
      clientName: "Phone",
      durationMs: 14,
      reason: "RESOLVED",
      questionName: "google.com",
      answer: "142.250.80.46",
      responseType: "RESOLVED",
      questionType: "A",
    },
    {
      offsetMs: 5 * DAY,
      clientIp: "192.168.1.10",
      clientName: "laptop",
      durationMs: 7,
      reason: "BLOCKED (tracker.list)",
      questionName: "blocked-site.com",
      answer: "0.0.0.0",
      responseType: "BLOCKED",
      questionType: "A",
    },
    {
      offsetMs: 5 * DAY + 6 * HOUR,
      clientIp: "192.168.1.10",
      clientName: "laptop",
      durationMs: 21,
      reason: "RESOLVED",
      questionName: "GitHub.com",
      answer: "140.82.121.3",
      responseType: "RESOLVED",
      questionType: "A",
    },
    {
      offsetMs: 5 * DAY + 18 * HOUR,
      clientIp: "192.168.1.30",
      clientName: "server-01",
      durationMs: 5,
      reason: "RESOLVED",
      questionName: "example.org",
      answer: "93.184.216.34",
      responseType: "RESOLVED",
      questionType: "CNAME",
    },
    {
      offsetMs: 6 * DAY,
      clientIp: "192.168.1.10",
      clientName: "laptop",
      durationMs: 17,
      reason: "RESOLVED",
      questionName: "google.com",
      answer: "142.250.80.46",
      responseType: "RESOLVED",
      questionType: "A",
    },
    {
      offsetMs: 6 * DAY + 12 * HOUR,
      clientIp: "192.168.1.20",
      clientName: "Phone",
      durationMs: 9,
      reason: "CACHED",
      questionName: "google.com",
      answer: "142.250.80.46",
      responseType: "CACHED",
      questionType: "A",
    },
    {
      offsetMs: 6 * DAY + 20 * HOUR,
      clientIp: "192.168.1.10",
      clientName: "laptop",
      durationMs: 4,
      reason: "RESOLVED",
      questionName: null,
      answer: "10.0.0.3",
      responseType: "RESOLVED",
      questionType: "A",
    },
  ];

  const last30d: EntryTemplate[] = [
    {
      offsetMs: 8 * DAY,
      clientIp: "192.168.1.10",
      clientName: "laptop",
      durationMs: 23,
      reason: "RESOLVED",
      questionName: "google.com",
      answer: "142.250.80.46",
      responseType: "RESOLVED",
      questionType: "A",
    },
    {
      offsetMs: 10 * DAY,
      clientIp: "192.168.1.20",
      clientName: "Phone",
      durationMs: 6,
      reason: "BLOCKED (ads.list)",
      questionName: "blocked-site.com",
      answer: "0.0.0.0",
      responseType: "BLOCKED",
      questionType: "A",
    },
    {
      offsetMs: 12 * DAY,
      clientIp: "192.168.1.20",
      clientName: "Phone",
      durationMs: 11,
      reason: "BLOCKED (malware.list)",
      questionName: "blocked-site.com",
      answer: "0.0.0.0",
      responseType: "BLOCKED",
      questionType: "A",
    },
    {
      offsetMs: 14 * DAY,
      clientIp: "192.168.1.30",
      clientName: "server-01",
      durationMs: 10,
      reason: "RESOLVED",
      questionName: "example.org",
      answer: "93.184.216.34",
      responseType: "RESOLVED",
      questionType: "A",
    },
    {
      offsetMs: 16 * DAY,
      clientIp: "192.168.1.10",
      clientName: "laptop",
      durationMs: 8,
      reason: "RESOLVED",
      questionName: "google.com",
      answer: "142.250.80.46",
      responseType: "RESOLVED",
      questionType: "CNAME",
    },
    {
      offsetMs: 18 * DAY,
      clientIp: "192.168.1.10",
      clientName: "laptop",
      durationMs: 12,
      reason: "CACHED",
      questionName: "google.com",
      answer: "142.250.80.46",
      responseType: "CACHED",
      questionType: "A",
    },
    {
      offsetMs: 20 * DAY,
      clientIp: "192.168.1.40",
      clientName: null,
      durationMs: 19,
      reason: "RESOLVED",
      questionName: null,
      answer: "10.0.0.4",
      responseType: "RESOLVED",
      questionType: "AAAA",
    },
    {
      offsetMs: 22 * DAY,
      clientIp: "192.168.1.10",
      clientName: "laptop",
      durationMs: 15,
      reason: "RESOLVED",
      questionName: "GitHub.com",
      answer: "140.82.121.3",
      responseType: "RESOLVED",
      questionType: "AAAA",
    },
    {
      offsetMs: 25 * DAY,
      clientIp: "192.168.1.10",
      clientName: "laptop",
      durationMs: 7,
      reason: "RESOLVED",
      questionName: "google.com",
      answer: "142.250.80.46",
      responseType: "RESOLVED",
      questionType: "A",
    },
    {
      offsetMs: 28 * DAY,
      clientIp: "192.168.1.30",
      clientName: "server-01",
      durationMs: 13,
      reason: "CACHED",
      questionName: "example.org",
      answer: "93.184.216.34",
      responseType: "CACHED",
      questionType: "A",
    },
  ];

  const older: EntryTemplate[] = [
    {
      offsetMs: 35 * DAY,
      clientIp: "192.168.1.10",
      clientName: "laptop",
      durationMs: 30,
      reason: "RESOLVED",
      questionName: "google.com",
      answer: "142.250.80.46",
      responseType: "RESOLVED",
      questionType: "A",
    },
    {
      offsetMs: 40 * DAY,
      clientIp: "192.168.1.20",
      clientName: "Phone",
      durationMs: null,
      reason: "BLOCKED (ads.list)",
      questionName: "blocked-site.com",
      answer: "0.0.0.0",
      responseType: "BLOCKED",
      questionType: "A",
    },
    {
      offsetMs: 45 * DAY,
      clientIp: "192.168.1.30",
      clientName: "server-01",
      durationMs: 9,
      reason: "RESOLVED",
      questionName: "example.org",
      answer: "93.184.216.34",
      responseType: "RESOLVED",
      questionType: "AAAA",
    },
  ];

  return [...last1h, ...last24h, ...last7d, ...last30d, ...older];
}

export function createSeedData(): LogEntry[] {
  const now = Date.now();
  const templates = createTemplates();

  const entries = templates.map((template) => buildEntry(template, now));

  entries.sort((a, b) => {
    const tsA = a.requestTs ?? "";
    const tsB = b.requestTs ?? "";
    return tsB.localeCompare(tsA);
  });

  return entries;
}

export function countEntriesInRange(
  entries: LogEntry[],
  range: TimeRange,
): { total: number; blocked: number; cached: number } {
  const { startTime } = getTimeRangeConfig(range);

  let total = 0;
  let blocked = 0;
  let cached = 0;

  for (const entry of entries) {
    const ts = entry.requestTs ? new Date(entry.requestTs).getTime() : 0;
    if (ts >= startTime.getTime()) {
      total++;
      if (entry.responseType === "BLOCKED") {
        blocked++;
      }
      if (entry.responseType === "CACHED") {
        cached++;
      }
    }
  }

  return { total, blocked, cached };
}
