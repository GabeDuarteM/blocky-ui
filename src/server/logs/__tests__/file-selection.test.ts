import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { describe, it, expect } from "vitest";
import { CsvLogProvider } from "~/server/logs/csv/provider";
import { CsvClientLogProvider } from "~/server/logs/csv/client-provider";
import { formatDate, entryToCsvLine, makeEntry } from "./setup";

describe("csv provider: file selection", () => {
  it("returns empty results when directory has no log files", async () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), "csv-empty-"));

    try {
      fs.writeFileSync(path.join(directory, "readme.txt"), "not a log file");

      const provider = new CsvLogProvider({ directory });
      const result = await provider.getQueryLogs({ limit: 100, offset: 0 });

      expect(result.totalCount).toBe(0);
      expect(result.items).toHaveLength(0);
    } finally {
      fs.rmSync(directory, { recursive: true, force: true });
    }
  });

  it("reads only the most recently modified log file", async () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), "csv-select-"));

    try {
      const oldEntry = makeEntry({
        clientName: "old-client",
        questionName: "old-domain.com",
      });
      const newEntry = makeEntry({
        requestTs: new Date(Date.now() - 30_000).toISOString(),
        clientIp: "10.0.0.2",
        clientName: "new-client",
        questionName: "new-domain.com",
        answer: "5.6.7.8",
        durationMs: 10,
      });

      const oldFile = path.join(directory, "old.log");
      fs.writeFileSync(oldFile, entryToCsvLine(oldEntry));
      const pastTime = Date.now() - 10_000;
      fs.utimesSync(oldFile, pastTime / 1000, pastTime / 1000);

      const newFile = path.join(directory, "new.log");
      fs.writeFileSync(newFile, entryToCsvLine(newEntry));

      const provider = new CsvLogProvider({ directory });
      const result = await provider.getQueryLogs({ limit: 100, offset: 0 });

      expect(result.totalCount).toBe(1);
      expect(result.items[0]?.questionName).toBe("new-domain.com");
    } finally {
      fs.rmSync(directory, { recursive: true, force: true });
    }
  });
});

describe("csv-client provider: date-based file selection", () => {
  it("reads only files from the latest date prefix", async () => {
    const directory = fs.mkdtempSync(
      path.join(os.tmpdir(), "csv-client-date-"),
    );

    try {
      const todayEntry = makeEntry({ questionName: "today-domain.com" });
      const yesterdayEntry = makeEntry({
        requestTs: new Date(
          Date.now() - 24 * 60 * 60 * 1000 - 60_000,
        ).toISOString(),
        clientIp: "10.0.0.2",
        questionName: "yesterday-domain.com",
        answer: "5.6.7.8",
        durationMs: 10,
      });

      const today = formatDate(new Date());
      const yesterday = formatDate(new Date(Date.now() - 24 * 60 * 60 * 1000));

      fs.writeFileSync(
        path.join(directory, `${today}_laptop.log`),
        entryToCsvLine(todayEntry),
      );
      fs.writeFileSync(
        path.join(directory, `${yesterday}_laptop.log`),
        entryToCsvLine(yesterdayEntry),
      );

      const provider = new CsvClientLogProvider({ directory });
      const result = await provider.getQueryLogs({ limit: 100, offset: 0 });

      expect(result.totalCount).toBe(1);
      expect(result.items[0]?.questionName).toBe("today-domain.com");
    } finally {
      fs.rmSync(directory, { recursive: true, force: true });
    }
  });

  it("reads files from all clients for the latest date", async () => {
    const directory = fs.mkdtempSync(
      path.join(os.tmpdir(), "csv-client-multi-"),
    );

    try {
      const entry1 = makeEntry({
        clientName: "laptop",
        questionName: "domain-a.com",
      });
      const entry2 = makeEntry({
        requestTs: new Date(Date.now() - 30_000).toISOString(),
        clientIp: "10.0.0.2",
        clientName: "phone",
        questionName: "domain-b.com",
        answer: "5.6.7.8",
        durationMs: 10,
      });

      const today = formatDate(new Date());

      fs.writeFileSync(
        path.join(directory, `${today}_laptop.log`),
        entryToCsvLine(entry1),
      );
      fs.writeFileSync(
        path.join(directory, `${today}_phone.log`),
        entryToCsvLine(entry2),
      );

      const provider = new CsvClientLogProvider({ directory });
      const result = await provider.getQueryLogs({ limit: 100, offset: 0 });

      expect(result.totalCount).toBe(2);
      const domains = result.items.map((i) => i.questionName);
      expect(domains).toContain("domain-a.com");
      expect(domains).toContain("domain-b.com");
    } finally {
      fs.rmSync(directory, { recursive: true, force: true });
    }
  });
});
