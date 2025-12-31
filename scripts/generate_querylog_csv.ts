import * as fs from "fs";
import * as path from "path";

interface Args {
  output?: string;
  rows?: string;
  days?: string;
  type?: string;
  "per-client"?: string;
  clients?: string;
  hostname?: string;
  "start-from"?: string;
  help?: string;
  [key: string]: string | undefined;
}

interface Client {
  ip: string;
  names: string[];
}

interface Entry {
  timestamp: Date;
  clientIP: string;
  clientNames: string[];
  durationMs: number;
  responseReason: string;
  questionName: string;
  answer: string;
  responseCode: string;
  responseType: string;
  questionType: string;
  blockyInstance: string;
}

const sampleData = {
  clientIPs: [
    "192.168.1.10",
    "192.168.1.20",
    "192.168.1.30",
    "192.168.1.40",
    "10.0.0.5",
    "10.0.0.15",
    "10.0.0.25",
    "172.16.0.100",
    "172.16.0.101",
    "172.16.0.102",
  ],

  clientNames: [
    "laptop",
    "phone",
    "tablet",
    "desktop",
    "smart-tv",
    "iot-device",
    "server",
    "nas",
    "printer",
    "camera",
  ],

  domains: [
    "google.com.",
    "github.com.",
    "stackoverflow.com.",
    "reddit.com.",
    "amazon.com.",
    "youtube.com.",
    "twitter.com.",
    "facebook.com.",
    "netflix.com.",
    "cloudflare.com.",
    "example.com.",
    "localhost.",
    "ads.tracking.com.",
    "telemetry.microsoft.com.",
    "analytics.google.com.",
    "doubleclick.net.",
    "facebook-ads.com.",
    "tracker.example.org.",
  ],

  questionTypes: ["A", "AAAA", "CNAME", "MX", "TXT", "NS", "PTR", "SRV"],

  responseCodes: ["NOERROR", "NXDOMAIN", "SERVFAIL", "REFUSED"],

  responseTypes: ["RESOLVED", "CACHED", "BLOCKED", "CONDITIONAL"],

  upstreams: ["cloudflare", "google", "quad9"],

  blockingGroups: ["ads", "tracking", "malware"],

  ipAnswers: [
    "A (1.2.3.4)",
    "A (142.250.80.110)",
    "A (140.82.121.4)",
    "AAAA (2607:f8b0:4004:800::200e)",
    "A (93.184.216.34)",
    "CNAME (www.example.com.)",
    "MX (10 mail.example.com.)",
  ],
};

function parseArgs(argv: string[]): Args {
  const result: Args = {};
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg?.startsWith("--")) {
      const key = arg.slice(2);
      const next = argv[i + 1];
      if (next && !next.startsWith("--")) {
        result[key] = next;
        i++;
      } else {
        result[key] = "";
      }
    }
  }
  return result;
}

function randomElement<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)] as T;
}

function formatDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatTimestamp(date: Date): string {
  const datePart = formatDate(date);
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  const seconds = String(date.getSeconds()).padStart(2, "0");
  return `${datePart} ${hours}:${minutes}:${seconds}`;
}

function generateClientPool(count: number): Client[] {
  const clients: Client[] = [];
  for (let i = 0; i < count; i++) {
    const numNames = Math.floor(Math.random() * 2) + 1;
    const names: string[] = [];
    for (let j = 0; j < numNames; j++) {
      names.push(randomElement(sampleData.clientNames));
    }
    clients.push({
      ip: randomElement(sampleData.clientIPs),
      names,
    });
  }
  return clients;
}

function generateEntriesForClient(
  date: Date,
  count: number,
  client: Client,
  blockyHost: string,
): Entry[] {
  const entries: Entry[] = [];
  const startOfDay = new Date(date);
  startOfDay.setHours(0, 0, 0, 0);

  for (let i = 0; i < count; i++) {
    const timestamp = new Date(startOfDay);
    timestamp.setHours(Math.floor(Math.random() * 24));
    timestamp.setMinutes(Math.floor(Math.random() * 60));
    timestamp.setSeconds(Math.floor(Math.random() * 60));

    const responseType = randomElement(sampleData.responseTypes);
    let responseCode = "NOERROR";
    let responseReason: string;
    let answer = randomElement(sampleData.ipAnswers);

    switch (responseType) {
      case "BLOCKED":
        responseCode = "NXDOMAIN";
        answer = "";
        responseReason = `BLOCKED (${randomElement(sampleData.blockingGroups)})`;
        break;
      case "RESOLVED":
        responseReason = `RESOLVED (${randomElement(sampleData.upstreams)})`;
        break;
      default:
        responseReason = responseType;
    }

    entries.push({
      timestamp,
      clientIP: client.ip,
      clientNames: client.names,
      durationMs: Math.floor(Math.random() * 500) + 1,
      responseReason,
      questionName: randomElement(sampleData.domains),
      answer,
      responseCode,
      responseType,
      questionType: randomElement(sampleData.questionTypes),
      blockyInstance: blockyHost,
    });
  }

  return entries;
}

function escapeClientName(name: string): string {
  return name.replace(/[^a-zA-Z0-9_-]/g, "_");
}

function entryToRow(entry: Entry): string {
  return [
    formatTimestamp(entry.timestamp),
    entry.clientIP,
    entry.clientNames.join("; "),
    String(entry.durationMs),
    entry.responseReason,
    entry.questionName,
    entry.answer,
    entry.responseCode,
    entry.responseType,
    entry.questionType,
    entry.blockyInstance,
  ].join("\t");
}

function writeCSVFile(filePath: string, entries: Entry[]): void {
  const sorted = entries.toSorted(
    (a, b) => a.timestamp.getTime() - b.timestamp.getTime(),
  );
  const rows = sorted.map(entryToRow);
  const content = rows.join("\n") + "\n";
  fs.writeFileSync(filePath, content);
  console.log(`  Created: ${filePath} (${entries.length} entries)`);
}

function writeAllFile(date: Date, entries: Entry[], outputDir: string): void {
  const filename = `${formatDate(date)}_ALL.log`;
  writeCSVFile(path.join(outputDir, filename), entries);
}

function writePerClientFiles(
  date: Date,
  entries: Entry[],
  outputDir: string,
): void {
  const byClient = new Map<string, Entry[]>();

  for (const entry of entries) {
    const key = escapeClientName(entry.clientNames.join("-"));
    if (!byClient.has(key)) {
      byClient.set(key, []);
    }
    byClient.get(key)!.push(entry);
  }

  for (const [clientKey, clientEntries] of byClient) {
    const filename = `${formatDate(date)}_${clientKey}.log`;
    writeCSVFile(path.join(outputDir, filename), clientEntries);
  }
}

function showHelp(): void {
  console.log(`Usage: npx tsx scripts/generate_querylog_csv.ts [options]

Options:
  --output <dir>       Output directory for CSV files (default: ".")
  --rows <n>           Number of log entries to generate (default: 100)
  --days <n>           Number of days to generate logs for (default: 1)
  --type <type>        Log type: "csv" or "csv-client" (default: "csv")
  --per-client         Generate csv-client format (separate files per client)
  --clients <n>        Number of unique clients to simulate (default: 3)
  --hostname <name>    Blocky instance hostname (default: "blocky-instance")
  --start-from <date>  Start date in YYYY-MM-DD format (default: today)
  --help               Show this help message
`);
}

function main(): void {
  const args = parseArgs(process.argv.slice(2));

  if (args.help !== undefined) {
    showHelp();
    return;
  }

  const config = {
    outputDir: args.output || ".",
    numRows: parseInt(args.rows || "100", 10),
    numDays: parseInt(args.days || "1", 10),
    perClient:
      args.type === "csv-client" ||
      args["per-client"] === "true" ||
      args["per-client"] === "",
    numClients: parseInt(args.clients || "3", 10),
    blockyHost: args.hostname || "blocky-instance",
    startFrom: args["start-from"],
  };

  if (!fs.existsSync(config.outputDir)) {
    fs.mkdirSync(config.outputDir, { recursive: true });
  }

  const clients = generateClientPool(config.numClients);

  let startDate: Date;
  if (config.startFrom) {
    startDate = new Date(config.startFrom + "T00:00:00");
    if (isNaN(startDate.getTime())) {
      console.error(
        `Invalid date format: ${config.startFrom}. Use YYYY-MM-DD.`,
      );
      process.exit(1);
    }
  } else {
    startDate = new Date();
  }
  startDate.setHours(0, 0, 0, 0);

  for (let day = 0; day < config.numDays; day++) {
    const date = new Date(startDate);
    date.setDate(date.getDate() - day);

    const allEntries: Entry[] = [];
    for (const client of clients) {
      const clientEntries = generateEntriesForClient(
        date,
        config.numRows,
        client,
        config.blockyHost,
      );
      allEntries.push(...clientEntries);
    }

    if (config.perClient) {
      writePerClientFiles(date, allEntries, config.outputDir);
    } else {
      writeAllFile(date, allEntries, config.outputDir);
    }
  }

  console.log(`Generated query log CSV files in ${config.outputDir}`);
}

main();
