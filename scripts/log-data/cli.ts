import { TransferError } from "./errors";
import { importVictoriaLogs } from "./import-victorialogs";
import { parseArgs } from "node:util";
import { z } from "zod";
import { exportMysql } from "./export-mysql";
import { importFiles } from "./import-files";
import { importSql } from "./import-sql";
import { readSnapshot, verifySnapshot } from "./snapshot";
import { transformRecord } from "./record";

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    "source-env": { type: "string" },
    "target-env": { type: "string" },
    out: { type: "string" },
    snapshot: { type: "string" },
    to: { type: "string" },
    limit: { type: "string" },
    offset: { type: "string", default: "+00:00" },
    "latest-at": { type: "string" },
    hostname: { type: "string" },
    help: { type: "boolean" },
  },
});

function required(value: string | undefined, name: string) {
  if (!value) {
    throw new TransferError(`Missing ${name}.`);
  }
  return value;
}

function environment(name: string | undefined, flag: string) {
  return required(
    process.env[required(name, flag)],
    `environment variable named by ${flag}`,
  );
}

async function main() {
  const command = positionals[0];

  if (values.help) {
    console.log(`Export: log-data export --source-env SOURCE_URL --out ./snapshot [--limit 10000] [--offset +00:00]
Verify: log-data verify --snapshot ./snapshot
Import: log-data import --snapshot ./snapshot --to mysql|postgresql|timescale|sqlite --target-env TARGET
Logs:   log-data import --snapshot ./snapshot --to victorialogs --target-env TARGET_URL
Files:  log-data import --snapshot ./snapshot --to csv|csv-client|console --out ./logs
Import options: --latest-at <UTC ISO timestamp> --hostname <name>
SQL destinations must be empty and initialized by Blocky. SQLite TARGET is a file path.
Console exports native JSON lines for ingestion into VictoriaLogs. See scripts/log-data/README.md.`);
    return;
  }

  if (command === "export") {
    const offset = z
      .string()
      .regex(/^[+-](?:0\d|1[0-3]):[0-5]\d$|^[+-]14:00$/)
      .parse(values.offset);
    const limit =
      values.limit === undefined
        ? undefined
        : z.coerce.number().int().positive().parse(values.limit);
    console.log(
      JSON.stringify(
        await exportMysql({
          url: environment(values["source-env"], "--source-env"),
          output: required(values.out, "--out"),
          offset,
          limit,
        }),
        null,
        2,
      ),
    );
    return;
  }

  const snapshot = required(values.snapshot, "--snapshot");
  const manifest = await verifySnapshot(snapshot);

  if (command === "verify") {
    console.log(JSON.stringify(manifest, null, 2));
    return;
  }

  if (command !== "import") {
    throw new TransferError(
      "Choose export, import or verify. Use --help for examples.",
    );
  }

  const type = z
    .enum([
      "mysql",
      "postgresql",
      "timescale",
      "sqlite",
      "csv",
      "csv-client",
      "console",
      "victorialogs",
    ])
    .parse(values.to);
  const latest =
    values["latest-at"] === undefined
      ? undefined
      : z.iso.datetime().parse(values["latest-at"]);
  const shiftMs =
    latest && manifest.lastTimestamp
      ? Date.parse(latest) - Date.parse(manifest.lastTimestamp)
      : 0;

  async function* records() {
    for await (const record of readSnapshot(snapshot)) {
      yield transformRecord(record, { shiftMs, hostname: values.hostname });
    }
  }

  const result =
    type === "csv" || type === "csv-client" || type === "console"
      ? await importFiles(type, required(values.out, "--out"), records())
      : type === "victorialogs"
        ? await importVictoriaLogs(
            environment(values["target-env"], "--target-env"),
            records(),
          )
        : await importSql(
            type,
            environment(values["target-env"], "--target-env"),
            records(),
          );

  console.log(
    JSON.stringify(
      {
        destination: type,
        ...result,
        shiftMs,
        hostname: values.hostname,
        losses:
          type === "console" ||
          type === "victorialogs" ||
          type === "csv" ||
          type === "csv-client"
            ? [
                "No effective TLD field; null and empty values cannot be distinguished; original DNS spelling cannot be recovered.",
                ...(type === "console" || type === "victorialogs"
                  ? [
                      "Request time substitutes for console emission time; zero values are omitted.",
                    ]
                  : [
                      "Timestamps have UTC second precision; client filenames reconstruct names by splitting on '; '.",
                    ]),
              ]
            : [],
      },
      null,
      2,
    ),
  );
}

try {
  await main();
} catch (error) {
  // Driver errors can contain credentials or query values. Keep their details out of terminal output.
  console.error(
    error instanceof TransferError
      ? error.message
      : error instanceof Error
        ? `Transfer failed (${error.name}). Check configuration, snapshot integrity and destination emptiness. No source data was modified.`
        : "Transfer failed.",
  );
  process.exitCode = 1;
}
