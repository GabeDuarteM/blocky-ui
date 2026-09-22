import type { LogEntry } from "~/server/logs/types";

export function identifyQueryLogRows<T extends LogEntry & { sourceId: string }>(
  entries: T[],
) {
  const occurrences = new Map<string, number>();

  return entries.map((entry) => {
    const identity =
      entry.id === null || entry.id === undefined
        ? JSON.stringify(
            Object.entries(entry).sort(([left], [right]) =>
              left.localeCompare(right),
            ),
          )
        : JSON.stringify([entry.sourceId, entry.id]);
    const occurrence = occurrences.get(identity) ?? 0;
    occurrences.set(identity, occurrence + 1);
    return { ...entry, rowId: JSON.stringify([identity, occurrence]) };
  });
}

export type QueryLogRow = ReturnType<typeof identifyQueryLogRows>[number];
