import { TransferError } from "./errors";
import { z } from "zod";
import { consoleRecord } from "./import-files";
import { type RecordEntry } from "./record";

export async function importVictoriaLogs(
  target: string,
  records: AsyncIterable<RecordEntry>,
) {
  const base = new URL(target);
  if (!base.pathname.endsWith("/")) {
    base.pathname += "/";
  }

  async function count() {
    const response = await fetch(new URL("select/logsql/query", base), {
      method: "POST",
      body: new URLSearchParams({ query: "* | stats count() as total" }),
      signal: AbortSignal.timeout(30_000),
    });

    if (!response.ok) {
      throw new TransferError("VictoriaLogs count request failed.");
    }

    const text = (await response.text()).trim();
    return text
      ? z.object({ total: z.coerce.number() }).parse(JSON.parse(text)).total
      : 0;
  }

  if ((await count()) !== 0) {
    throw new TransferError("VictoriaLogs destination must be empty.");
  }

  let inserted = 0;
  let batch: string[] = [];

  async function flush() {
    if (batch.length === 0) {
      return;
    }

    const url = new URL("insert/jsonline", base);
    url.searchParams.set("_time_field", "time");
    url.searchParams.set("_msg_field", "msg");
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/stream+json" },
      body: batch.join("\n") + "\n",
      signal: AbortSignal.timeout(30_000),
    });

    if (!response.ok) {
      throw new TransferError(
        "VictoriaLogs import failed. Discard this partial test destination before retrying.",
      );
    }

    inserted += batch.length;
    batch = [];
  }

  for await (const record of records) {
    batch.push(JSON.stringify(consoleRecord(record)));

    if (batch.length === 500) {
      await flush();
    }
  }

  await flush();
  const deadline = Date.now() + 15_000;

  while (Date.now() < deadline) {
    if ((await count()) === inserted) {
      return { count: inserted };
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }

  throw new TransferError(
    "VictoriaLogs count differs from the import. Check retention and use a fresh destination before retrying.",
  );
}
