import type { LogEntry } from "~/server/logs/types";

const reasonSuffixPattern = /\s*\(.*\)\s*$/u;
const reasonContextPattern = /\((?<context>.*)\)\s*$/u;

export function getQueryReason({
  reason,
  responseType,
}: Pick<LogEntry, "reason" | "responseType">) {
  const label =
    reason?.replace(reasonSuffixPattern, "").trim() ||
    responseType ||
    "Unknown";
  const context = (reason ?? "")
    .match(reasonContextPattern)
    ?.groups?.context?.trim();
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
