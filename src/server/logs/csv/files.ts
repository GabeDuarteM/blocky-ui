import { readdir, stat } from "node:fs/promises";
import { join } from "node:path";
import { mapConcurrent } from "~/server/utils/map-concurrent";

export function isMissingFile(error: unknown) {
  return error instanceof Error && "code" in error && error.code === "ENOENT";
}

const fileDatePattern = /^(\d{4})-(\d{2})-(\d{2})_.+\.log$/;

function fileDay(name: string) {
  const date = name.match(fileDatePattern);
  if (!date) {
    return;
  }
  const year = Number(date[1]);
  const month = Number(date[2]) - 1;
  const day = Number(date[3]);
  const start = new Date(year, month, day);
  if (
    start.getFullYear() !== year ||
    start.getMonth() !== month ||
    start.getDate() !== day
  ) {
    return;
  }
  return {
    start: start.getTime(),
    end: new Date(year, month, day + 1).getTime(),
  };
}

export async function listCsvFiles(
  directory: string,
  perClient: boolean,
  since = Number.NEGATIVE_INFINITY,
  until = Number.POSITIVE_INFINITY,
) {
  const names = await readdir(directory);
  const candidates = names.flatMap((name) => {
    const day = fileDay(name);
    if (
      !name.endsWith(".log") ||
      (perClient && !day) ||
      (day && (day.end <= since || day.start > until))
    ) {
      return [];
    }
    return [{ path: join(directory, name), day }];
  });
  const files = (
    await mapConcurrent(candidates, 4, async (file) => {
      try {
        const info = await stat(file.path);
        return info.isFile()
          ? [
              {
                ...file,
                size: info.size,
                modified: info.mtimeMs,
                version: [
                  info.dev,
                  info.ino,
                  info.size,
                  info.mtimeMs,
                  info.ctimeMs,
                ].join(":"),
              },
            ]
          : [];
      } catch (error) {
        if (isMissingFile(error)) {
          return [];
        }
        throw error;
      }
    })
  ).flat();
  const dated = files.filter((file) => file.day);
  if (dated.length > 0 || perClient) {
    return dated.sort((a, b) => a.path.localeCompare(b.path));
  }
  return files.sort((a, b) => b.modified - a.modified).slice(0, 1);
}

export type CsvFile = Awaited<ReturnType<typeof listCsvFiles>>[number];

let activeScans = 0;
const waiting: (() => void)[] = [];

export async function withCsvScan<T>(read: () => Promise<T>) {
  if (activeScans >= 2) {
    await new Promise<void>((resolve) => waiting.push(resolve));
  } else {
    activeScans += 1;
  }
  try {
    return await read();
  } finally {
    const next = waiting.shift();
    if (next) {
      next();
    } else {
      activeScans -= 1;
    }
  }
}
