import { TransferError } from "./errors";
import { createReadStream, createWriteStream } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { createInterface } from "node:readline";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { createGunzip, createGzip } from "node:zlib";
import { z } from "zod";
import { fingerprint, recordSchema, type RecordEntry } from "./record";

const manifestSchema = z.object({
  version: z.literal(1),
  source: z.literal("mysql"),
  sourceOffset: z.string(),
  createdAt: z.iso.datetime(),
  count: z.number().int().nonnegative(),
  fingerprint: z.string().regex(/^[a-f0-9]{64}$/),
  firstTimestamp: z.iso.datetime().nullable(),
  lastTimestamp: z.iso.datetime().nullable(),
});

function snapshotSummary() {
  const digest = fingerprint();
  let firstTimestamp: string | null = null;
  let lastTimestamp: string | null = null;

  return {
    add(record: RecordEntry) {
      digest.add(record);
      firstTimestamp =
        firstTimestamp === null || record.requestTs < firstTimestamp
          ? record.requestTs
          : firstTimestamp;
      lastTimestamp =
        lastTimestamp === null || record.requestTs > lastTimestamp
          ? record.requestTs
          : lastTimestamp;
    },
    result() {
      return { ...digest.result(), firstTimestamp, lastTimestamp };
    },
  };
}

export async function writeSnapshot(
  directory: string,
  records: AsyncIterable<RecordEntry>,
  sourceOffset: string,
) {
  await mkdir(directory, { mode: 0o700 });
  const digest = snapshotSummary();

  async function* lines() {
    for await (const value of records) {
      const record = recordSchema.parse(value);
      digest.add(record);
      yield `${JSON.stringify(record)}\n`;
    }
  }

  await pipeline(
    Readable.from(lines()),
    createGzip(),
    createWriteStream(join(directory, "records.jsonl.gz"), {
      flags: "wx",
      mode: 0o600,
    }),
  );

  const manifest = manifestSchema.parse({
    version: 1,
    source: "mysql",
    sourceOffset,
    createdAt: new Date().toISOString(),
    ...digest.result(),
  });
  await writeFile(
    join(directory, "manifest.json"),
    `${JSON.stringify(manifest, null, 2)}\n`,
    { flag: "wx", mode: 0o600 },
  );

  return manifest;
}

export async function* readSnapshot(directory: string) {
  const input = createReadStream(join(directory, "records.jsonl.gz"));
  const decompressed = createGunzip();
  const completion = pipeline(input, decompressed);
  void completion.catch(() => undefined);
  const lines = createInterface({ input: decompressed, crlfDelay: Infinity });

  try {
    for await (const line of lines) {
      yield recordSchema.parse(JSON.parse(line));
    }
    await completion;
  } finally {
    lines.close();
    decompressed.destroy();
    input.destroy();
    await completion.catch(() => undefined);
  }
}

export async function verifySnapshot(directory: string) {
  const manifest = manifestSchema.parse(
    JSON.parse(await readFile(join(directory, "manifest.json"), "utf8")),
  );
  const digest = snapshotSummary();

  for await (const record of readSnapshot(directory)) {
    digest.add(record);
  }

  const actual = digest.result();

  if (
    actual.count !== manifest.count ||
    actual.fingerprint !== manifest.fingerprint ||
    actual.firstTimestamp !== manifest.firstTimestamp ||
    actual.lastTimestamp !== manifest.lastTimestamp
  ) {
    throw new TransferError("Snapshot contents do not match the manifest.");
  }

  return manifest;
}
