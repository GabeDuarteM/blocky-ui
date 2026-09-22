const reasonSuffixPattern = /\s*\(.*\)\s*$/;
const reasonContextPattern = /\((.*)\)\s*$/;

import type { LogEntry } from "~/server/logs/types";

export function getQueryReason({
  reason,
  responseType,
}: Pick<LogEntry, "reason" | "responseType">) {
  const label =
    reason?.replace(reasonSuffixPattern, "").trim() ||
    responseType ||
    "Unknown";
  const context = (reason ?? "").match(reasonContextPattern)?.[1]?.trim();
  let detail = context ?? null;

  if (responseType === "REBIND") {
    detail = "Blocked by DNS rebinding protection";
  } else if (context && responseType === "BLOCKED") {
    detail = `Group: ${context}`;
  } else if (context && responseType === "RESOLVED") {
    detail = `Resolved by: ${context}`;
  }

  return { label, detail };
}

export function formatQueryDuration({
  durationMs,
  responseType,
}: Pick<LogEntry, "durationMs" | "responseType">) {
  if (durationMs === null) {
    return "Unknown";
  }

  if (
    durationMs === 0 &&
    [
      "CACHED",
      "HOSTSFILE",
      "CUSTOMDNS",
      "BLOCKED",
      "SPECIAL",
      "FILTERED",
      "NOTFQDN",
    ].includes(responseType ?? "")
  ) {
    return "Local";
  }

  return `${durationMs} ms`;
}
