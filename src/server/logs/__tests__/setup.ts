import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import {
  MySqlContainer,
  type StartedMySqlContainer,
} from "@testcontainers/mysql";
import {
  PostgreSqlContainer,
  type StartedPostgreSqlContainer,
} from "@testcontainers/postgresql";
import { createConnection } from "mysql2/promise";
import postgres from "postgres";
import { sql } from "drizzle-orm";
import { drizzle as drizzlePg } from "drizzle-orm/postgres-js";

import { MySQLLogProvider } from "~/server/logs/mysql/provider";
import { PostgreSQLLogProvider } from "~/server/logs/postgres/provider";
import { logEntries as pgLogEntries } from "~/server/logs/postgres/schema";
import { CsvLogProvider } from "~/server/logs/csv/provider";
import { CsvClientLogProvider } from "~/server/logs/csv/client-provider";
import { type LogEntry, type LogProvider } from "~/server/logs/types";
import { createSeedData } from "./seed-data";

const CREATE_TABLE_SQL = `
  CREATE TABLE IF NOT EXISTS log_entries (
    id INT AUTO_INCREMENT NOT NULL PRIMARY KEY,
    request_ts DATETIME(3) NULL,
    client_ip LONGTEXT NULL,
    client_name VARCHAR(191) NULL,
    duration_ms BIGINT NULL,
    reason LONGTEXT NULL,
    response_type VARCHAR(191) NULL,
    question_type LONGTEXT NULL,
    question_name LONGTEXT NULL,
    effective_tldp LONGTEXT NULL,
    answer LONGTEXT NULL,
    response_code LONGTEXT NULL,
    hostname LONGTEXT NULL,
    INDEX idx_log_entries_request_ts (request_ts),
    INDEX idx_log_entries_client_name (client_name),
    INDEX idx_log_entries_response_type (response_type)
  )
`;

const INSERT_SQL = `
  INSERT INTO log_entries
    (request_ts, client_ip, client_name, duration_ms, reason, response_type,
     question_type, question_name, effective_tldp, answer, response_code, hostname)
  VALUES ?
`;

export function formatDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

// Field order matches csv/utils.ts parseLogLine. effectiveTldp and id are
// excluded to match Blocky's actual CSV output format.
export function entryToCsvLine(entry: LogEntry): string {
  const fields = [
    entry.requestTs ?? "",
    entry.clientIp ?? "",
    entry.clientName ?? "",
    entry.durationMs != null ? String(entry.durationMs) : "",
    entry.reason ?? "",
    entry.questionName ?? "",
    entry.answer ?? "",
    entry.responseCode ?? "",
    entry.responseType ?? "",
    entry.questionType ?? "",
    entry.hostname ?? "",
  ];
  return fields.join("\t");
}

export function makeEntry(overrides: Partial<LogEntry> = {}): LogEntry {
  return {
    requestTs: new Date(Date.now() - 60_000).toISOString(),
    clientIp: "10.0.0.1",
    clientName: "test-client",
    durationMs: 5,
    reason: "RESOLVED",
    questionName: "test-domain.com",
    answer: "1.2.3.4",
    responseCode: "NOERROR",
    responseType: "RESOLVED",
    questionType: "A",
    hostname: "test",
    effectiveTldp: null,
    id: null,
    ...overrides,
  };
}

function isoToMysqlDatetime(iso: string): string {
  return iso.replace("T", " ").replace("Z", "");
}

// Field order must match INSERT_SQL column order exactly
function entryToMysqlRow(entry: LogEntry): unknown[] {
  return [
    entry.requestTs ? isoToMysqlDatetime(entry.requestTs) : null,
    entry.clientIp ?? null,
    entry.clientName ?? null,
    entry.durationMs ?? null,
    entry.reason ?? null,
    entry.responseType ?? null,
    entry.questionType ?? null,
    entry.questionName ?? null,
    entry.effectiveTldp ?? null,
    entry.answer ?? null,
    entry.responseCode ?? null,
    entry.hostname ?? null,
  ];
}

async function setupMysql(entries: LogEntry[]): Promise<{
  provider: MySQLLogProvider;
  container: StartedMySqlContainer;
}> {
  const container = await new MySqlContainer("mysql:8.0")
    .withDatabase("test_db")
    .start();

  try {
    const connectionUri = container.getConnectionUri();
    const connection = await createConnection(connectionUri);

    try {
      await connection.execute(CREATE_TABLE_SQL);

      if (entries.length > 0) {
        const rows = entries.map(entryToMysqlRow);
        await connection.query(INSERT_SQL, [rows]);
      }
    } finally {
      await connection.end();
    }

    const provider = new MySQLLogProvider({ connectionUri });
    return { provider, container };
  } catch (error) {
    await container.stop();
    throw error;
  }
}

async function setupPostgres(entries: LogEntry[]): Promise<{
  provider: PostgreSQLLogProvider;
  container: StartedPostgreSqlContainer;
}> {
  const container = await new PostgreSqlContainer("postgres:16")
    .withDatabase("test_db")
    .start();

  try {
    const connectionUri = container.getConnectionUri();
    const conn = postgres(connectionUri);
    const db = drizzlePg(conn);

    try {
      await db.execute(sql`
        CREATE TABLE IF NOT EXISTS log_entries (
          request_ts TIMESTAMPTZ NULL,
          client_ip TEXT NULL,
          client_name TEXT NULL,
          duration_ms BIGINT NULL,
          reason TEXT NULL,
          response_type TEXT NULL,
          question_type TEXT NULL,
          question_name TEXT NULL,
          effective_tldp TEXT NULL,
          answer TEXT NULL,
          response_code TEXT NULL,
          hostname TEXT NULL
        )
      `);

      if (entries.length > 0) {
        await db.insert(pgLogEntries).values(
          entries.map((entry) => ({
            requestTs: entry.requestTs,
            clientIp: entry.clientIp,
            clientName: entry.clientName,
            durationMs: entry.durationMs,
            reason: entry.reason,
            responseType: entry.responseType,
            questionType: entry.questionType,
            questionName: entry.questionName,
            effectiveTldp: entry.effectiveTldp,
            answer: entry.answer,
            responseCode: entry.responseCode,
            hostname: entry.hostname,
          })),
        );
      }
    } finally {
      await conn.end();
    }

    const provider = new PostgreSQLLogProvider({ connectionUri });
    return { provider, container };
  } catch (error) {
    await container.stop();
    throw error;
  }
}

function setupCsv(entries: LogEntry[]): {
  provider: CsvLogProvider;
  directory: string;
} {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "csv-test-"));
  const chronological = [...entries].reverse();
  const lines = chronological.map(entryToCsvLine);
  fs.writeFileSync(path.join(directory, "test.log"), lines.join("\n"));

  const provider = new CsvLogProvider({ directory });
  return { provider, directory };
}

function setupCsvClient(entries: LogEntry[]): {
  provider: CsvClientLogProvider;
  directory: string;
} {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "csv-client-test-"));
  // All entries use today's date prefix because CsvClientLogProvider only reads
  // the latest-date files. Using actual dates from requestTs would exclude older
  // entries from the conformance suite. Dedicated file-selection tests in the
  // test file verify multi-date behavior separately.
  const datePrefix = formatDate(new Date());

  const grouped = new Map<string, LogEntry[]>();
  for (const entry of entries) {
    const clientKey = entry.clientName ?? "unknown";
    const existing = grouped.get(clientKey) ?? [];
    existing.push(entry);
    grouped.set(clientKey, existing);
  }

  for (const [clientName, clientEntries] of grouped) {
    const fileName = `${datePrefix}_${clientName}.log`;
    const chronological = [...clientEntries].reverse();
    const lines = chronological.map(entryToCsvLine);
    fs.writeFileSync(path.join(directory, fileName), lines.join("\n"));
  }

  const provider = new CsvClientLogProvider({ directory });
  return { provider, directory };
}

export async function setupProviders(): Promise<{
  providers: Map<string, LogProvider>;
  seedData: LogEntry[];
  cleanup: () => Promise<void>;
}> {
  const seedData = createSeedData();

  const [mysqlResult, postgresResult, csvResult, csvClientResult] =
    await Promise.all([
      setupMysql(seedData),
      setupPostgres(seedData),
      Promise.resolve(setupCsv(seedData)),
      Promise.resolve(setupCsvClient(seedData)),
    ]);

  const providers = new Map<string, LogProvider>([
    ["mysql", mysqlResult.provider],
    ["postgres", postgresResult.provider],
    ["csv", csvResult.provider],
    ["csv-client", csvClientResult.provider],
  ]);

  const cleanup = async () => {
    await mysqlResult.provider.close?.();
    await mysqlResult.container.stop();
    await postgresResult.provider.close?.();
    await postgresResult.container.stop();
    fs.rmSync(csvResult.directory, { recursive: true, force: true });
    fs.rmSync(csvClientResult.directory, { recursive: true, force: true });
  };

  return { providers, seedData, cleanup };
}
