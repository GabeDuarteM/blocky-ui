import type { LogEntry } from "~/server/logs/types";
import { faker } from "@faker-js/faker";
import {
  BLOCKY_DNS_RECORD_TYPES,
  BLOCKY_RESPONSE_TYPES,
} from "~/lib/constants";

// Use weighted pools to create realistic distribution
const DOMAIN_POOL = [
  { domain: "google.com", weight: 25 },
  { domain: "github.com", weight: 18 },
  { domain: "cloudflare.com", weight: 15 },
  { domain: "api.openai.com", weight: 12 },
  { domain: "cdn.jsdelivr.net", weight: 10 },
  { domain: "doubleclick.net", weight: 8, blocked: true },
  { domain: "analytics.google.com", weight: 7 },
  { domain: "fonts.googleapis.com", weight: 6 },
  { domain: "ads.facebook.com", weight: 5, blocked: true },
  { domain: "tracker.example.com", weight: 4, blocked: true },
  { domain: "mail.google.com", weight: 4 },
  { domain: "slack.com", weight: 3 },
  { domain: "reddit.com", weight: 3 },
  { domain: "spotify.com", weight: 2 },
  { domain: "netflix.com", weight: 2 },
];

const CLIENT_POOL = [
  { ip: "192.168.1.100", weight: 30 },
  { ip: "192.168.1.101", weight: 22 },
  { ip: "192.168.1.105", weight: 18 },
  { ip: "192.168.1.150", weight: 12 },
  { ip: "192.168.1.200", weight: 8 },
  { ip: "192.168.1.42", weight: 5 },
  { ip: "192.168.1.88", weight: 3 },
  { ip: "192.168.1.233", weight: 2 },
];

function weightedPick<T extends { weight: number }>(pool: readonly T[]): T {
  if (pool.length === 0) {
    throw new Error("weightedPick called with empty pool");
  }
  const totalWeight = pool.reduce((sum, item) => sum + item.weight, 0);
  let random = faker.number.int({ min: 0, max: totalWeight - 1 });
  for (const item of pool) {
    random -= item.weight;
    if (random < 0) return item;
  }

  const pick = pool[pool.length - 1];

  if (!pick) {
    throw new Error("weightedPick called with empty pool");
  }

  return pick;
}

const generateMockLogEntry = (id: number): LogEntry => {
  const domainEntry = weightedPick(DOMAIN_POOL);
  const clientEntry = weightedPick(CLIENT_POOL);

  const responseType = domainEntry.blocked
    ? "BLOCKED"
    : faker.helpers.arrayElement(BLOCKY_RESPONSE_TYPES);

  let reason = responseType;

  if (responseType === "BLOCKED") {
    reason += ` (ad-group)`;
  } else if (responseType === "RESOLVED") {
    reason += ` (${faker.helpers.arrayElement([
      "https://dns.google/dns-query",
      "https://cloudflare-dns.com/dns-query",
      "https://dns.quad9.net/dns-query",
    ])})`;
  }

  return {
    id,
    requestTs: faker.date
      .between({
        from: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
        to: new Date(),
      })
      .toISOString(),
    clientIp: clientEntry.ip,
    clientName: clientEntry.ip,
    durationMs: faker.number.int({ min: 1, max: 100 }),
    reason,
    responseType,
    questionType: faker.helpers.arrayElement(BLOCKY_DNS_RECORD_TYPES),
    questionName: domainEntry.domain,
    effectiveTldp: null,
    answer: faker.internet.ip(),
    responseCode: "NOERROR",
    hostname: domainEntry.domain,
  };
};

export const logEntryMock: LogEntry[] = Array.from({ length: 200 }, (_, i) =>
  generateMockLogEntry(i + 1),
);
