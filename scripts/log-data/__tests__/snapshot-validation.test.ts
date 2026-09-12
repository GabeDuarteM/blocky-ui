import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, expect, it, vi } from "vitest";
import { recordSchema } from "../record";
import { verifySnapshot, writeSnapshot } from "../snapshot";
import { importFiles } from "../import-files";
import { importVictoriaLogs } from "../import-victorialogs";

const sample = recordSchema.parse({
  requestTs: "2026-09-10T10:00:00.000Z",
  clientIp: null,
  clientName: null,
  durationMs: 0,
  reason: null,
  responseType: "RESOLVED",
  questionType: "A",
  questionName: "example.test",
  effectiveTldp: null,
  answer: null,
  responseCode: "NOERROR",
  hostname: "blocky",
});

async function* records() {
  yield sample;
  yield { ...sample, requestTs: "2026-09-10T11:00:00.000Z" };
}

afterEach(() => vi.unstubAllGlobals());

it.each(["firstTimestamp", "lastTimestamp"])(
  "rejects an altered %s before import",
  async (field) => {
    const directory = await mkdtemp(join(tmpdir(), "snapshot-bounds-"));

    try {
      const target = join(directory, "snapshot");
      const manifest = await writeSnapshot(target, records(), "+00:00");
      expect(await verifySnapshot(target)).toEqual(manifest);

      await writeFile(
        join(target, "manifest.json"),
        JSON.stringify({ ...manifest, [field]: "2025-01-01T00:00:00.000Z" }),
      );

      await expect(verifySnapshot(target)).rejects.toThrow("do not match");
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  },
);

it("creates output parents but refuses to overwrite an existing import", async () => {
  const directory = await mkdtemp(join(tmpdir(), "import-parents-"));

  try {
    const target = join(directory, "nested", "logs");
    expect(await importFiles("console", target, records())).toEqual({
      count: 2,
    });
    const file = join(target, "querylog.jsonl");
    const original = await readFile(file, "utf8");

    await expect(importFiles("console", target, records())).rejects.toThrow(
      "EEXIST",
    );
    expect(await readFile(file, "utf8")).toBe(original);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

it.each(["/vlogs", "/vlogs/", "/vlogs?tenant=demo"])(
  "preserves the VictoriaLogs prefix %s for count and insert",
  async (path) => {
    const requests: URL[] = [];
    let inserted = false;
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: URL) => {
        requests.push(url);
        if (url.pathname.endsWith("insert/jsonline")) {
          inserted = true;
          return new Response("");
        }
        return Response.json({ total: inserted ? 2 : 0 });
      }),
    );

    expect(
      await importVictoriaLogs(`http://example.test${path}`, records()),
    ).toEqual({ count: 2 });
    expect(requests.map((url) => url.pathname)).toEqual([
      "/vlogs/select/logsql/query",
      "/vlogs/insert/jsonline",
      "/vlogs/select/logsql/query",
    ]);
  },
);
