import { streamAndParseEntries } from "~/server/logs/csv/utils";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import {
  GenericContainer,
  Network,
  Wait,
  type StartedNetwork,
  type StartedTestContainer,
} from "testcontainers";
import {
  mkdtemp,
  chmod,
  cp,
  readFile,
  readdir,
  rm,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createConnection } from "mysql2/promise";
import { stringify } from "yaml";
import { exportMysql } from "../export-mysql";
import { importSql } from "../import-sql";
import { importFiles, csvLine, consoleRecord } from "../import-files";
import { importVictoriaLogs } from "../import-victorialogs";
import { readSnapshot, verifySnapshot, writeSnapshot } from "../snapshot";
import { type RecordEntry } from "../record";
import { drizzle } from "drizzle-orm/mysql2";
import { logEntries } from "~/server/logs/mysql/schema";

const cleanup: Array<() => Promise<unknown>> = [];
let directory: string;
let network: StartedNetwork;
let sourceUrl: string;
let sample: RecordEntry[];

async function* records(entries = sample) {
  yield* entries;
}

async function query(writer: StartedTestContainer) {
  const response = await fetch(
    `http://${writer.getHost()}:${writer.getMappedPort(4000)}/api/query`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query: "transfer.test", type: "A" }),
    },
  );
  expect(response.ok).toBe(true);
}

function importSnapshot() {
  return process.env["BLOCKY_TRANSFER_SNAPSHOT"] ?? join(directory, "paged");
}

async function blocky(type: string, target: string, output?: string) {
  const container = new GenericContainer("ghcr.io/0xerr0r/blocky:v0.34.0")
    .withNetwork(network)
    .withExposedPorts(4000)
    .withCopyContentToContainer([
      {
        target: "/app/config.yml",
        content: stringify({
          ports: { dns: 53, http: 4000 },
          upstreams: { groups: { default: ["1.1.1.1"] } },
          customDNS: { mapping: { "transfer.test": "192.0.2.42" } },
          queryLog: { type, target, flushInterval: "1s", logRetentionDays: 0 },
          log: { level: "info", format: "json" },
        }),
      },
    ])
    .withWaitStrategy(Wait.forHttp("/api/blocking/status", 4000));

  if (output) {
    container
      .withUser("0:0")
      .withBindMounts([{ source: output, target: "/data", mode: "rw" }]);
  }

  const started = await container.start();
  cleanup.push(() => started.stop());
  return started;
}

beforeAll(async () => {
  directory = await mkdtemp(join(tmpdir(), "blocky-transfer-"));
  cleanup.push(() => rm(directory, { recursive: true, force: true }));
  network = await new Network().start();
  cleanup.push(() => network.stop());

  const mysql = await new GenericContainer("mariadb:11")
    .withNetwork(network)
    .withNetworkAliases("source")
    .withEnvironment({
      MARIADB_ROOT_PASSWORD: "transfer-test",
      MARIADB_DATABASE: "blocky",
    })
    .withExposedPorts(3306)
    .withWaitStrategy(Wait.forLogMessage(/ready for connections/, 2))
    .start();
  cleanup.push(() => mysql.stop());
  sourceUrl = `mysql://root:transfer-test@${mysql.getHost()}:${mysql.getMappedPort(3306)}/blocky`;
  const writer = await blocky(
    "mysql",
    "root:transfer-test@tcp(source:3306)/blocky?charset=utf8mb4&parseTime=True&loc=UTC",
  );

  for (let index = 0; index < 3; index++) {
    await query(writer);
  }

  await vi.waitFor(
    async () => {
      const connection = await createConnection(sourceUrl);
      try {
        const [rows] = await connection.query(
          "SELECT COUNT(*) AS total FROM log_entries",
        );
        expect(JSON.stringify(rows)).toBe('[{"total":3}]');
      } finally {
        await connection.end();
      }
    },
    { timeout: 10_000 },
  );
  await writer.stop();

  const manifest = await exportMysql({
    url: sourceUrl,
    output: join(directory, "snapshot"),
  });
  expect(manifest.count).toBe(3);
  sample = [];
  for await (const row of readSnapshot(join(directory, "snapshot"))) {
    sample.push(row);
  }
}, 120_000);

afterAll(async () => {
  for (const stop of cleanup.reverse()) {
    await stop();
  }
}, 120_000);

describe("portable Blocky logs", () => {
  it("exports native MySQL records without changing them and checks snapshot integrity", async () => {
    const snapshot = join(directory, "snapshot");
    expect((await verifySnapshot(snapshot)).count).toBe(3);
    expect(sample[0]?.questionName).toBe("transfer.test");
    expect(sample[0]?.answer).toBe("A (192.0.2.42)");
    expect(
      (
        await exportMysql({
          url: sourceUrl,
          output: join(directory, "limited"),
          limit: 2,
        })
      ).count,
    ).toBe(2);

    const corrupt = join(directory, "corrupt");
    await writeSnapshot(corrupt, records(), "+00:00");
    await writeFile(join(corrupt, "records.jsonl.gz"), "broken");
    await expect(verifySnapshot(corrupt)).rejects.toThrow();
  });

  it("crosses MySQL page boundaries without dropping duplicates or changing the source", async () => {
    const first = sample[0];
    if (!first) {
      throw new Error("Missing native record");
    }
    const connection = await createConnection(sourceUrl);
    try {
      const db = drizzle(connection);
      for (let page = 0; page < 3; page++) {
        await db.insert(logEntries).values(
          Array.from({ length: 500 }, (_, index) => ({
            ...first,
            requestTs: first.requestTs.replace("T", " ").replace("Z", ""),
            answer: index % 2 ? null : 'quoted "value"\twith\nnewlines é',
            clientName: "client; laptop",
          })),
        );
      }
      const [before] = await connection.query(
        "SELECT COUNT(*) AS total, MAX(id) AS lastId FROM log_entries",
      );
      const result = await exportMysql({
        url: sourceUrl,
        output: join(directory, "paged"),
      });
      expect(result.count).toBe(1503);
      expect(await verifySnapshot(join(directory, "paged"))).toEqual(result);
      const [after] = await connection.query(
        "SELECT COUNT(*) AS total, MAX(id) AS lastId FROM log_entries",
      );
      expect(after).toEqual(before);
    } finally {
      await connection.end();
    }
  });

  it("imports MySQL into a native empty table and refuses a second import", async () => {
    const connection = await createConnection(sourceUrl);
    await connection.query("CREATE DATABASE transfer_target");
    await connection.end();
    const writer = await blocky(
      "mysql",
      "root:transfer-test@tcp(source:3306)/transfer_target?charset=utf8mb4&parseTime=True&loc=UTC",
    );
    await writer.stop();
    const target = new URL(sourceUrl);
    target.pathname = "/transfer_target";
    expect(
      (
        await importSql(
          "mysql",
          target.toString(),
          readSnapshot(importSnapshot()),
        )
      ).count,
    ).toBe((await verifySnapshot(importSnapshot())).count);
    await expect(
      importSql("mysql", target.toString(), records()),
    ).rejects.toThrow("empty");
  }, 120_000);

  it.each([
    ["postgresql", "postgres:16"],
    ["timescale", "timescale/timescaledb:2.26.0-pg16"],
  ] as const)(
    "imports into native %s and refuses to overwrite it",
    async (type, image) => {
      const pg = await new GenericContainer(image)
        .withNetwork(network)
        .withNetworkAliases(`target-${type}`)
        .withEnvironment({
          POSTGRES_PASSWORD: "transfer-test",
          POSTGRES_DB: "blocky",
        })
        .withExposedPorts(5432)
        .withWaitStrategy(
          Wait.forLogMessage(
            /database system is ready to accept connections/,
            2,
          ),
        )
        .start();
      cleanup.push(() => pg.stop());
      const writer = await blocky(
        type,
        `postgres://postgres:transfer-test@target-${type}:5432/blocky?sslmode=disable`,
      );
      await writer.stop();
      const url = `postgres://postgres:transfer-test@${pg.getHost()}:${pg.getMappedPort(5432)}/blocky`;
      expect(
        (await importSql(type, url, readSnapshot(importSnapshot()))).count,
      ).toBe((await verifySnapshot(importSnapshot())).count);
      await expect(importSql(type, url, records())).rejects.toThrow("empty");
    },
    120_000,
  );

  it("imports into a native SQLite file and rolls back an interrupted import", async () => {
    const folder = await mkdtemp(join(directory, "sqlite-"));
    await chmod(folder, 0o777);
    const writer = await blocky("sqlite", "/data/blocky.db", folder);
    await writer.stop();
    const importedFolder = join(directory, "sqlite-import");
    await cp(folder, importedFolder, { recursive: true });
    const target = join(importedFolder, "blocky.db");

    async function* broken() {
      for (let index = 0; index < 501; index++) {
        yield* sample;
      }
      throw new Error("interrupted");
    }

    await expect(importSql("sqlite", target, broken())).rejects.toThrow(
      "interrupted",
    );
    expect(
      (await importSql("sqlite", target, readSnapshot(importSnapshot()))).count,
    ).toBe((await verifySnapshot(importSnapshot())).count);
    await expect(importSql("sqlite", target, records())).rejects.toThrow(
      "empty",
    );
  }, 120_000);

  it("writes native file formats and imports console events into VictoriaLogs", async () => {
    for (const type of ["csv", "csv-client", "console"] as const) {
      expect(
        (await importFiles(type, join(directory, type), records())).count,
      ).toBe(3);
      await expect(
        importFiles(type, join(directory, type), records()),
      ).rejects.toThrow();
    }

    const lines = await readFile(
      join(directory, "console", "querylog.jsonl"),
      "utf8",
    );
    expect(JSON.parse(lines.split("\n")[0] ?? "")).toEqual(
      sample[0] ? consoleRecord(sample[0]) : undefined,
    );
    const victoria = await new GenericContainer(
      "victoriametrics/victoria-logs:v1.48.0",
    )
      .withExposedPorts(9428)
      .withCommand(["-retentionPeriod=100y"])
      .withWaitStrategy(Wait.forHttp("/", 9428))
      .start();
    cleanup.push(() => victoria.stop());
    const url = `http://${victoria.getHost()}:${victoria.getMappedPort(9428)}/`;
    expect(
      (await importVictoriaLogs(url, readSnapshot(importSnapshot()))).count,
    ).toBe((await verifySnapshot(importSnapshot())).count);
    await expect(importVictoriaLogs(url, records())).rejects.toThrow("empty");
  }, 120_000);

  it.each(["csv", "csv-client"] as const)(
    "matches native Blocky %s field order and filenames",
    async (type) => {
      const folder = await mkdtemp(join(directory, `native-${type}-`));
      await chmod(folder, 0o777);
      const writer = await blocky(type, "/data", folder);
      await query(writer);
      await vi.waitFor(
        async () => {
          expect(
            (await readdir(folder)).some((file) => file.endsWith(".log")),
          ).toBe(true);
        },
        { timeout: 10_000 },
      );
      await writer.stop();
      const filename = (await readdir(folder)).find((file) =>
        file.endsWith(".log"),
      );
      const first = sample[0];
      if (!filename || !first) {
        throw new Error("Missing native output");
      }
      const native = await readFile(join(folder, filename), "utf8");
      expect(native.trimEnd().split("\t").slice(4, 10)).toEqual(
        csvLine(first).trimEnd().split("\t").slice(4, 10),
      );
      const converted = join(directory, `native-converted-${type}`);
      await importFiles(
        type,
        converted,
        records([{ ...first, clientName: native.split("\t")[2] ?? "" }]),
      );
      expect(await readdir(converted)).toContain(filename);
    },
    120_000,
  );

  it("reads quoted and multiline converted answers through the dashboard provider", async () => {
    const first = sample[0];
    if (!first) {
      throw new Error("Missing native record");
    }
    const values = [
      first,
      { ...first, answer: 'TXT ("value\twith\nnewlines")' },
    ];
    const folder = join(directory, "quoted-csv");
    await importFiles("csv", folder, records(values));
    const filename = (await readdir(folder))[0];
    if (!filename) {
      throw new Error("Missing CSV output");
    }
    const actual = await streamAndParseEntries(join(folder, filename));
    expect(actual.map((row) => row.answer)).toEqual(
      values.map((row) => row.answer),
    );
  });

  it("quotes tabs, newlines and quotes like Go's tab-separated CSV writer", () => {
    const first = sample[0];
    expect(first).toBeDefined();
    if (!first) {
      throw new Error("Missing native record");
    }
    expect(csvLine({ ...first, answer: 'a\t"b"\nc' })).toContain(
      '"a\t""b""\nc"',
    );
    expect(consoleRecord({ ...first, durationMs: 0 })).not.toHaveProperty(
      "duration_ms",
    );
  });
});
