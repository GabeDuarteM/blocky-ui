import { normalizeLogTimestamp } from "~/server/logs/timestamp";
import { TransferError } from "./errors";
import { createHash } from "node:crypto";
import { z } from "zod";

const columns = {
  requestTs: "request_ts",
  clientIp: "client_ip",
  clientName: "client_name",
  durationMs: "duration_ms",
  reason: "reason",
  responseType: "response_type",
  questionType: "question_type",
  questionName: "question_name",
  effectiveTldp: "effective_tldp",
  answer: "answer",
  responseCode: "response_code",
  hostname: "hostname",
} as const;

export const recordSchema = z.object({
  requestTs: z.iso.datetime(),
  clientIp: z.string().nullable(),
  clientName: z.string().nullable(),
  durationMs: z.number().int().nullable(),
  reason: z.string().nullable(),
  responseType: z.string().nullable(),
  questionType: z.string().nullable(),
  questionName: z.string().nullable(),
  effectiveTldp: z.string().nullable(),
  answer: z.string().nullable(),
  responseCode: z.string().nullable(),
  hostname: z.string().nullable(),
});

export type RecordEntry = z.infer<typeof recordSchema>;

export function timestamp(value: unknown, offset = "+00:00") {
  if (value instanceof Date) {
    return value.toISOString();
  }

  if (typeof value !== "string" || value.length === 0) {
    throw new TransferError("A log record has no valid timestamp.");
  }

  const iso = value.replace(" ", "T");
  const zoned = /(?:Z|[+-]\d\d(?::?\d\d)?)$/.test(iso)
    ? iso
    : `${iso}${offset}`;
  const parsed = normalizeLogTimestamp(zoned);

  if (!parsed) {
    throw new TransferError("A log record has an invalid timestamp.");
  }

  return parsed;
}

export function databaseRecord(value: unknown, offset = "+00:00") {
  const row = z.record(z.string(), z.unknown()).parse(value);
  const fields = Object.fromEntries(
    Object.entries(columns).map(([field, column]) => [field, row[column]]),
  );

  return recordSchema.parse({
    ...fields,
    requestTs: timestamp(fields.requestTs, offset),
    durationMs: fields.durationMs === null ? null : Number(fields.durationMs),
  });
}

export function fingerprint() {
  let count = 0;
  let sum = 0n;
  const modulus = 1n << 256n;

  return {
    add(record: RecordEntry) {
      const bytes = JSON.stringify(recordSchema.parse(record));
      sum =
        (sum +
          BigInt(`0x${createHash("sha256").update(bytes).digest("hex")}`)) %
        modulus;
      count++;
    },
    result() {
      return { count, fingerprint: sum.toString(16).padStart(64, "0") };
    },
  };
}

export function transformRecord(
  record: RecordEntry,
  options: { shiftMs: number; hostname?: string },
): RecordEntry {
  return {
    ...record,
    requestTs: new Date(
      new Date(record.requestTs).getTime() + options.shiftMs,
    ).toISOString(),
    hostname: options.hostname ?? record.hostname,
  };
}
