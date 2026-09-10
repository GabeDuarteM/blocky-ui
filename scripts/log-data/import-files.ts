import { appendFile, mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { type RecordEntry } from "./record";

export type FileDestination = "csv" | "csv-client" | "console";

function quoteField(value: string) {
  if (
    value === "\\." ||
    /[\t\n\r"]/.test(value) ||
    /^\p{White_Space}/u.test(value)
  ) {
    return `"${value.replaceAll('"', '""')}"`;
  }

  return value;
}

function questionName(record: RecordEntry) {
  const name = record.questionName ?? "";
  return name && !name.endsWith(".") ? `${name}.` : name;
}

export function csvLine(record: RecordEntry) {
  return (
    [
      record.requestTs.slice(0, 19).replace("T", " "),
      record.clientIp ?? "",
      record.clientName ?? "",
      String(record.durationMs ?? 0),
      record.reason ?? "",
      questionName(record),
      record.answer ?? "",
      record.responseCode ?? "",
      record.responseType ?? "",
      record.questionType ?? "",
      record.hostname ?? "",
    ]
      .map(quoteField)
      .join("\t") + "\n"
  );
}

export function consoleRecord(record: RecordEntry) {
  const fields = {
    client_ip: record.clientIp,
    client_names: record.clientName,
    duration_ms: record.durationMs,
    response_reason: record.reason,
    response_type: record.responseType,
    response_code: record.responseCode,
    question_name: questionName(record),
    question_type: record.questionType,
    answer: record.answer,
    instance: record.hostname,
  };

  return {
    time: record.requestTs,
    level: "info",
    msg: "query resolved",
    prefix: "queryLog",
    ...Object.fromEntries(
      Object.entries(fields).filter(
        ([, value]) => value !== null && value !== "" && value !== 0,
      ),
    ),
  };
}

export async function importFiles(
  type: FileDestination,
  output: string,
  records: AsyncIterable<RecordEntry>,
) {
  await mkdir(dirname(output), { recursive: true, mode: 0o700 });
  await mkdir(output, { mode: 0o700 });
  let count = 0;
  const buffers = new Map<string, string[]>();

  async function flush() {
    for (const [filename, lines] of buffers) {
      await appendFile(join(output, filename), lines.join(""), { mode: 0o600 });
    }
    buffers.clear();
  }

  for await (const record of records) {
    const client = (record.clientName ?? "")
      .split("; ")
      .join("-")
      .replace(/[^a-zA-Z0-9_-]+/g, "_");
    const filename =
      type === "console"
        ? "querylog.jsonl"
        : `${record.requestTs.slice(0, 10)}_${type === "csv" ? "ALL" : client}.log`;
    const lines = buffers.get(filename) ?? [];
    lines.push(
      type === "console"
        ? `${JSON.stringify(consoleRecord(record))}\n`
        : csvLine(record),
    );
    buffers.set(filename, lines);
    count++;

    if (count % 500 === 0) {
      await flush();
    }
  }

  await flush();
  return { count };
}
