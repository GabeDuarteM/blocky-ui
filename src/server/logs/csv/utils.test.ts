import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, expect, it } from "vitest";
import { scanEntries, streamAndParseEntries } from "~/server/logs/csv/utils";

let directory: string;
beforeEach(async () => {
  directory = await mkdtemp(join(tmpdir(), "csv-parser-"));
});
afterEach(async () => {
  await rm(directory, { recursive: true, force: true });
});

const prefix =
  "2026-09-19T12:00:00Z\t10.0.0.1\tphone\t12\tRESOLVED\tdocs.example\t";
const suffix = "\tNOERROR\tRESOLVED\tTXT\tblocky";

it.each(
  ["\n", "\r\n", "\r"].flatMap((newline) =>
    [false, true].map((shortFirst) => ({ newline, shortFirst })),
  ),
)(
  "preserves quoted fields across chunks with $newline endings, short first row $shortFirst",
  async ({ newline, shortFirst }) => {
    const file = join(directory, "queries.log");
    const answer =
      "x".repeat(65535 - Buffer.byteLength(prefix) - 1) +
      'é\t"quoted"' +
      newline +
      "second line";
    const content =
      prefix +
      '"' +
      answer.replaceAll('"', '""') +
      '"' +
      suffix +
      newline +
      prefix +
      "plain" +
      suffix;
    await writeFile(
      file,
      shortFirst ? prefix + "first" + suffix + newline + content : content,
    );
    const parsed = await streamAndParseEntries(file);
    const rows = shortFirst ? parsed.slice(1) : parsed;
    expect(rows).toHaveLength(2);
    expect(rows.map((row) => row.answer)).toEqual([answer, "plain"]);
    expect(rows[0]).toMatchObject({
      requestTs: "2026-09-19T12:00:00.000Z",
      clientName: "phone",
      durationMs: 12,
      hostname: "blocky",
    });
  },
);

it.each([1, 2])("caps reads at a snapshot of %i rows", async (count) => {
  const file = join(directory, "queries.log");
  const first = prefix + "first" + suffix + "\n";
  await writeFile(file, first.repeat(count) + prefix + "later" + suffix + "\n");
  const answers: Array<string | null> = [];
  await scanEntries(
    file,
    (row) => {
      answers.push(row.answer);
    },
    Buffer.byteLength(first) * count,
  );
  expect(answers).toEqual(Array.from({ length: count }, () => "first"));
});

it.each([1, 2])(
  "rejects read and consumer errors with %i rows",
  async (count) => {
    const file = join(directory, "queries.log");
    await expect(streamAndParseEntries(file)).rejects.toMatchObject({
      code: "ENOENT",
    });
    const content = prefix + "answer" + suffix + "\n";
    await writeFile(file, content.repeat(count));
    await expect(
      scanEntries(
        file,
        () => {
          throw new Error("consumer failed");
        },
        Buffer.byteLength(content) * count,
      ),
    ).rejects.toThrow("consumer failed");
  },
);
