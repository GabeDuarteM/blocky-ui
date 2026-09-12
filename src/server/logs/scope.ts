import { type LogEntry, type LogScope } from "~/server/logs/types";

export function isEntryInScope(entry: LogEntry, scope: LogScope): boolean {
  return !entry.hostname || !scope.excludedHostnames?.includes(entry.hostname);
}
