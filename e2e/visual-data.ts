import type { RouterOutputs } from "~/trpc/react";

export function blockingStatus(
  enabled: boolean,
  autoEnableInSec = 0,
  serverId = "default",
) {
  return {
    serverId,
    success: true,
    data: {
      enabled,
      autoEnableInSec,
      disabledGroups: enabled ? [] : ["advertising", "telemetry"],
    },
  } satisfies RouterOutputs["servers"]["blockingStatus"][number];
}

export function serverFailure(serverId: string) {
  return {
    serverId,
    success: false,
    error: {
      kind: "timeout",
      message: "The server did not respond in time.",
    },
  } satisfies RouterOutputs["servers"]["query"][number];
}

export const longDomain =
  "telemetry.collector.production.eu-west.internal.example.com";
export const logEntries = [
  {
    requestTs: "2026-01-15T11:30:00.000Z",
    clientIp: "2001:db8:1234:5678::42",
    clientName: "living-room-home-assistant-production-controller",
    durationMs: 1234,
    reason: "RESOLVED (https://dns.example.com/dns-query)",
    questionName: longDomain,
    answer: "203.0.113.42",
    responseCode: "NOERROR",
    responseType: "RESOLVED",
    questionType: "AAAA",
    hostname: "Home",
    effectiveTldp: "example.com",
    sourceId: "default",
    serverId: "default",
    id: 1,
  },
  {
    requestTs: "2026-01-15T11:29:00.000Z",
    clientIp: "192.168.1.2",
    clientName: "phone",
    durationMs: 0,
    reason: "BLOCKED (advertising)",
    questionName: "ads.example.com",
    answer: null,
    responseCode: "NOERROR",
    responseType: "BLOCKED",
    questionType: "A",
    hostname: "Home",
    effectiveTldp: "example.com",
    sourceId: "default",
    serverId: "default",
    id: 2,
  },
  {
    requestTs: null,
    clientIp: null,
    clientName: null,
    durationMs: null,
    reason: null,
    questionName: null,
    answer: null,
    responseCode: null,
    responseType: null,
    questionType: null,
    hostname: null,
    effectiveTldp: null,
    sourceId: "default",
    serverId: null,
    id: 3,
  },
] satisfies RouterOutputs["logs"]["rows"]["items"];

export const queryResults = [
  {
    serverId: "default",
    success: true,
    data: {
      responseType: "BLOCKED",
      returnCode: "NOERROR",
      answers: [],
      detail: "Blocked by advertising and telemetry groups",
    },
  },
  {
    serverId: "demo-2",
    success: true,
    data: {
      responseType: "RESOLVED",
      returnCode: "NOERROR",
      answers: Array.from(
        { length: 12 },
        (_, i) =>
          `2001:0db8:1234:5678:abcd:ef01:2345:${String(i + 1).padStart(4, "0")}`,
      ),
      detail: "Resolved using the configured IPv6 upstream",
    },
  },
  serverFailure("demo-3"),
] satisfies RouterOutputs["servers"]["query"];

export const emptyLogs = {
  "logs.rows": { data: { items: [], diagnostics: [] } },
  "logs.count": { data: { totalCount: 0, diagnostics: [] } },
  "logs.queriesOverTime": { data: { items: [], diagnostics: [] } },
  "logs.topList": { data: { items: [], totalCount: 0, diagnostics: [] } },
};

export function serverStatistics(serverId: string, index = 0) {
  return {
    serverId,
    success: true,
    data: {
      overview: {
        totalQueries: 12_453,
        blocked: 2134,
        dropped: 12,
        errors: 3,
        blockedPercentage: 17.1,
        cacheHitRate: 87,
        listedDomains: 141_531 + index * 15_000,
        avgResponseMs: 12,
        cacheEntries: 4521,
        denylistGroups: 3 + index,
        allowlistDomains: 245 + index * 100,
      },
      summary: {
        queries: 12_453,
        cached: 8976,
        forwarded: 1343,
        blocked: 2134,
        dropped: 12,
        errors: 3,
        avgResponseMs: 12,
        cacheHitRate: 0.87,
      },
      answered: 12_453,
      queriesOverTime: [],
      topLists: { domains: [], blockedDomains: [], clients: [] },
    },
  } satisfies RouterOutputs["servers"]["statistics"][number];
}
