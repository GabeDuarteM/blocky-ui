// biome-ignore-all lint/style/noExcessiveClassesPerFile: Test doubles for the coordinator.
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Configuration } from "~/server/config/schema";
import { parseConfiguration } from "~/server/config/schema";
import { BaseMemoryLogProvider } from "~/server/logs/base-provider";
import { createLogCoordinator } from "~/server/logs/coordinator";
import { createFilterFn } from "~/server/logs/csv/utils";
import type {
  LogEntry,
  QueryLogFilters,
  QueryLogsOptions,
} from "~/server/logs/types";

function entry(
  questionName: string,
  hostname: string | null,
  id: number,
): LogEntry {
  return {
    id,
    hostname,
    questionName,
    requestTs: new Date(Date.now() - 60_000 - id * 1000).toISOString(),
    clientIp: "127.0.0.1",
    clientName: "laptop",
    durationMs: 1,
    reason: "RESOLVED",
    answer: "127.0.0.1",
    responseCode: "NOERROR",
    responseType: "RESOLVED",
    questionType: "A",
    effectiveTldp: null,
  };
}

class MemorySource extends BaseMemoryLogProvider {
  private readonly entries: LogEntry[];
  constructor(entries: LogEntry[]) {
    super();
    this.entries = entries;
  }
  getQueryLogs(options: QueryLogsOptions) {
    const filtered = this.entries.filter(createFilterFn(options));
    return Promise.resolve({
      items: filtered.slice(options.offset, options.offset + options.limit),
      totalCount: filtered.length,
    });
  }
  protected fetchEntriesInRange() {
    return Promise.resolve(this.entries);
  }
}

afterEach(() => vi.restoreAllMocks());

describe("multi-source query logs", () => {
  it("keeps a deep page stable when new rows arrive during the seek", async () => {
    const records = {
      a: Array.from({ length: 1000 }, (_, index) =>
        entry("a", null, index * 2),
      ),
      b: Array.from({ length: 1000 }, (_, index) =>
        entry("b", null, index * 2 + 1),
      ),
    };
    let inserted = false;

    class SnapshotSource extends MemorySource {
      private readonly rows: LogEntry[];
      constructor(rows: LogEntry[]) {
        super(rows);
        this.rows = rows;
      }

      getQueryLogSnapshot() {
        return Promise.resolve(
          Math.max(...this.rows.map((row) => row.id ?? 0)),
        );
      }

      private visible(filters: QueryLogFilters) {
        return this.rows.filter(
          (row) =>
            filters.maxId === undefined || (row.id ?? 0) <= filters.maxId,
        );
      }

      override getQueryLogRows(options: QueryLogsOptions) {
        return Promise.resolve(
          this.visible(options).slice(
            options.offset,
            options.offset + options.limit,
          ),
        );
      }

      getQueryLogCountSince(filters: QueryLogFilters, since: Date) {
        if (!inserted) {
          inserted = true;
          records.a.unshift(
            ...Array.from({ length: 100 }, (_, index) => ({
              ...entry("new", null, 10_000 + index),
              requestTs: new Date().toISOString(),
            })),
          );
        }

        return Promise.resolve(
          this.visible(filters).filter(
            (row) => new Date(row.requestTs ?? 0) >= since,
          ).length,
        );
      }
    }

    const configuration = parseConfiguration({
      servers: {
        a: { url: "http://a", logs: { source: "a" } },
        b: { url: "http://b", logs: { source: "b" } },
      },
      logSources: {
        a: { type: "csv", target: "a" },
        b: { type: "csv", target: "b" },
      },
    });
    const logs = createLogCoordinator(configuration, (source) =>
      Promise.resolve(
        new SnapshotSource(source.target === "a" ? records.a : records.b),
      ),
    );
    const result = await logs.rows(["a", "b"], { limit: 11, offset: 600 });

    expect(inserted).toBe(true);
    expect(result.diagnostics).toEqual([]);
    expect(result.items.map((row) => row.id)).toEqual(
      Array.from({ length: 11 }, (_, index) => 600 + index),
    );
  });

  it("reuses a large ranking when navigating to an uncached page", async () => {
    const configuration = parseConfiguration({
      servers: { a: { url: "http://a", logs: { source: "a" } } },
      logSources: { a: { type: "csv", target: "a" } },
    });
    const provider = new MemorySource([]);
    const groups = vi.spyOn(provider, "getTopDomains").mockImplementation(() =>
      Promise.resolve({
        items: Array.from({ length: 250_000 }, (_, index) => ({
          domain: `domain-${index}.${"long-domain-name".repeat(4)}`,
          count: 250_000 - index,
          blocked: 0,
          percentage: 0,
        })),
        totalCount: 250_000,
      }),
    );
    const logs = createLogCoordinator(configuration, () =>
      Promise.resolve(provider),
    );
    const options = {
      filter: "all",
      limit: 10,
      offset: 0,
      range: "30d",
      type: "domains",
    } as const;

    await logs.topList(["a"], options);
    const page = await logs.topList(["a"], { ...options, offset: 150_000 });

    expect(page.totalCount).toBe(250_000);
    expect(page.items[0]?.count).toBe(100_000);
    expect(groups).toHaveBeenCalledTimes(1);
  });

  it("locates a deep page without loading the preceding rows", async () => {
    const size = 3_500_000;
    const configuration = parseConfiguration({
      servers: {
        a: { url: "http://a", logs: { source: "a" } },
        b: { url: "http://b", logs: { source: "b" } },
      },
      logSources: {
        a: { type: "csv", target: "a" },
        b: { type: "csv", target: "b" },
      },
    });
    let transferred = 0;
    const logs = createLogCoordinator(configuration, (source) => {
      const provider = new MemorySource([]);
      vi.spyOn(provider, "getQueryLogCount").mockResolvedValue(size);
      vi.spyOn(provider, "getQueryLogRows").mockImplementation((options) => {
        if (options.limit > 256) {
          return Promise.reject(new Error("Unbounded row allocation"));
        }

        const length = Math.max(
          0,
          Math.min(options.limit, size - options.offset),
        );
        transferred += length;

        return Promise.resolve(
          Array.from({ length }, (_, index) =>
            entry(
              "virtual",
              null,
              (options.offset + index) * 2 + (source.target === "a" ? 0 : 1),
            ),
          ),
        );
      });

      return Promise.resolve(provider);
    });

    const result = await logs.rows(["a", "b"], { limit: 11, offset: size });

    expect(result.diagnostics).toEqual([]);
    expect(result.items.map((item) => item.id)).toEqual(
      Array.from({ length: 11 }, (_, index) => size + index),
    );
    expect(transferred).toBeLessThan(1000);
  });

  it("pages equal timestamps consistently across sources and selection order", async () => {
    const timestamp = new Date().toISOString();
    const configuration = parseConfiguration({
      servers: {
        a: { url: "http://a", logs: { source: "a" } },
        b: { url: "http://b", logs: { source: "b" } },
      },
      logSources: {
        a: { type: "csv", target: "a" },
        b: { type: "csv", target: "b" },
      },
    });
    const logs = createLogCoordinator(configuration, () =>
      Promise.resolve(
        new MemorySource(
          Array.from({ length: 7 }, (_, id) => ({
            ...entry("same", null, id),
            requestTs: timestamp,
          })),
        ),
      ),
    );
    const collected: string[] = [];

    for (let offset = 0; offset < 14; offset += 3) {
      // biome-ignore lint/performance/noAwaitInLoops: Exercise consecutive pages against the same cached snapshot.
      const page = await logs.rows(offset % 2 ? ["b", "a"] : ["a", "b"], {
        limit: 3,
        offset,
      });
      collected.push(
        ...page.items.map((item) => `${item.sourceId}:${item.id}`),
      );
    }

    expect(collected).toEqual(
      ["a", "b"].flatMap((source) =>
        Array.from({ length: 7 }, (_, id) => `${source}:${id}`),
      ),
    );
    expect(new Set(collected).size).toBe(14);
  });

  it("restarts page selection over healthy sources after a read fails mid-page", async () => {
    const configuration = parseConfiguration({
      servers: {
        a: { url: "http://a", logs: { source: "a" } },
        b: { url: "http://b", logs: { source: "b" } },
      },
      logSources: {
        a: { type: "csv", target: "a" },
        b: { type: "csv", target: "b" },
      },
    });
    const healthy = new MemorySource(
      Array.from({ length: 1000 }, (_, index) => entry("a", null, index * 2)),
    );
    const failing = new MemorySource(
      Array.from({ length: 1000 }, (_, index) =>
        entry("b", null, index * 2 + 1),
      ),
    );
    const read = failing.getQueryLogRows.bind(failing);
    let calls = 0;
    vi.spyOn(failing, "getQueryLogRows").mockImplementation((options) => {
      calls += 1;

      if (calls === 2) {
        return Promise.reject(new Error("Disconnected"));
      }

      return read(options);
    });
    const logs = createLogCoordinator(configuration, (source) =>
      Promise.resolve(source.target === "a" ? healthy : failing),
    );
    const result = await logs.rows(["a", "b"], { limit: 11, offset: 600 });

    expect(result.diagnostics).toEqual([
      { sourceId: "b", message: "Unable to read this log source." },
    ]);
    expect(result.items.map((item) => item.id)).toEqual(
      Array.from({ length: 11 }, (_, index) => (600 + index) * 2),
    );
  });

  it("reads shared sources once and retains unknown records when every mapped owner is unselected", async () => {
    const shared = new MemorySource([
      entry("a", "host-a", 1),
      entry("b", "host-b", 2),
      entry("unknown", null, 3),
    ]);
    const dedicated = new MemorySource([entry("c", null, 4)]);
    const sharedRows = vi.spyOn(shared, "getQueryLogRows");
    const configuration = parseConfiguration({
      servers: {
        a: { url: "http://a", logs: { source: "shared", hostname: "host-a" } },
        b: { url: "http://b", logs: { source: "shared", hostname: "host-b" } },
        c: { url: "http://c", logs: { source: "dedicated" } },
      },
      logSources: {
        shared: { type: "csv", target: "shared" },
        dedicated: { type: "csv", target: "dedicated" },
      },
    });
    const initialize = vi.fn((source: Configuration["logSources"][string]) =>
      Promise.resolve(source.target === "shared" ? shared : dedicated),
    );
    const logs = createLogCoordinator(configuration, initialize);
    const all = await logs.rows(["a", "b", "c"], { limit: 10, offset: 0 });
    expect(all.items.map((item) => item.serverId)).toEqual([
      "a",
      "b",
      null,
      "c",
    ]);
    expect(sharedRows).toHaveBeenCalledTimes(1);
    const scoped = await logs.rows(["c"], { limit: 10, offset: 0 });
    expect(scoped.items.map((item) => item.questionName)).toEqual([
      "unknown",
      "c",
    ]);
    expect(initialize).toHaveBeenCalledTimes(2);
    expect((await logs.count(["c"], {})).totalCount).toBe(2);
  });

  it("merges before paging and ranks full groups, with counts cached independently of pages", async () => {
    const a = new MemorySource([
      ...Array.from({ length: 6 }, (_, i) => entry("a-only", null, i * 2)),
      ...Array.from({ length: 5 }, (_, i) => entry("shared", null, 20 + i * 2)),
    ]);
    const b = new MemorySource([
      ...Array.from({ length: 6 }, (_, i) => entry("b-only", null, i * 2 + 1)),
      ...Array.from({ length: 5 }, (_, i) => entry("shared", null, 21 + i * 2)),
    ]);
    const counts = vi.spyOn(a, "getQueryLogCount");
    const groups = vi.spyOn(a, "getTopDomains");
    const configuration = parseConfiguration({
      servers: {
        a: { url: "http://a", logs: { source: "a" } },
        b: { url: "http://b", logs: { source: "b" } },
      },
      logSources: {
        a: { type: "csv", target: "a" },
        b: { type: "csv", target: "b" },
      },
    });
    const logs = createLogCoordinator(configuration, (source) =>
      Promise.resolve(source.target === "a" ? a : b),
    );
    const page = await logs.rows(["a", "b"], { limit: 3, offset: 3 });
    expect(page.items.map((item) => item.id)).toEqual([3, 4, 5]);
    expect(await logs.count(["a", "b"], {})).toMatchObject({ totalCount: 22 });
    await logs.rows(["a", "b"], { limit: 3, offset: 6 });
    await logs.count(["a", "b"], {});
    expect(counts).toHaveBeenCalledTimes(1);
    await logs.count(["a", "b"], { search: "shared" });
    expect(counts).toHaveBeenCalledTimes(2);
    await logs.count(["a", "b"], { domain: "shared" });
    expect(counts).toHaveBeenCalledTimes(3);
    expect(counts).toHaveBeenLastCalledWith(
      expect.objectContaining({ domain: "shared" }),
    );

    const options = {
      filter: "all",
      limit: 1,
      offset: 0,
      range: "24h",
      type: "domains",
    } as const;
    const first = await logs.topList(["a", "b"], options);
    expect(first.items[0]).toMatchObject({ name: "shared", count: 10 });
    expect(first.items[0]?.percentage).toBeCloseTo((10 / 22) * 100);
    expect(first.totalCount).toBe(3);
    await logs.topList(["b", "a"], { ...options, offset: 1 });
    expect(groups).toHaveBeenCalledTimes(1);

    const single = await logs.topList(["a"], options);
    expect(single.items[0]).toMatchObject({ name: "a-only", count: 6 });
    expect(groups).toHaveBeenCalledTimes(2);
  });

  it("keeps available results and retries a failed source initialization", async () => {
    const available = new MemorySource([entry("available", null, 1)]);
    const configuration = parseConfiguration({
      servers: {
        a: { url: "http://a", logs: { source: "a" } },
        b: { url: "http://b", logs: { source: "b" } },
      },
      logSources: {
        a: { type: "csv", target: "a" },
        b: { type: "csv", target: "b" },
      },
    });
    let offline = true;
    const initialize = vi.fn((source: Configuration["logSources"][string]) => {
      if (source.target === "b" && offline) {
        return Promise.reject(new Error("secret connection URI"));
      }
      return Promise.resolve(available);
    });
    const logs = createLogCoordinator(configuration, initialize);
    const result = await logs.rows(["a", "b"], { limit: 10, offset: 0 });
    expect(result.items).toHaveLength(1);
    expect(result.diagnostics).toEqual([
      { sourceId: "b", message: "Unable to read this log source." },
    ]);
    expect(JSON.stringify(result)).not.toContain("secret");
    const options = {
      filter: "all",
      limit: 10,
      offset: 0,
      range: "24h",
      type: "domains",
    } as const;
    expect((await logs.topList(["a", "b"], options)).diagnostics).toHaveLength(
      1,
    );

    offline = false;
    expect((await logs.topList(["a", "b"], options)).diagnostics).toEqual([]);

    expect(
      (await logs.rows(["a", "b"], { limit: 10, offset: 0 })).diagnostics,
    ).toEqual([]);
    expect(initialize).toHaveBeenCalledTimes(4);
  });

  it.each([
    ["initializing", "initialize"],
    ["reading", "read"],
  ] as const)(
    "logs why a source failed while %s, once per request and without its target",
    async (_, stage) => {
      const target = "mysql://blocky:hunter2@db.internal:3306/blocky";
      const configuration = parseConfiguration({
        servers: {
          a: { url: "http://a", logs: { source: "a" } },
          b: { url: "http://b", logs: { source: "b" } },
        },
        logSources: {
          a: { type: "csv", target: "a" },
          b: { type: "mysql", target },
        },
      });
      const failure = new Error("Failed query: select 1\nparams: hunter2", {
        cause: Object.assign(
          new Error("Access denied for user 'blocky'@'10.0.0.2'"),
          { code: "ER_ACCESS_DENIED_ERROR" },
        ),
      });
      const failing = new MemorySource([entry("b", null, 2)]);
      vi.spyOn(failing, "getQueryLogRows").mockRejectedValue(failure);
      const logs = createLogCoordinator(configuration, (source) => {
        if (source.target === "a") {
          return Promise.resolve(new MemorySource([entry("a", null, 1)]));
        }
        return stage === "initialize"
          ? Promise.reject(failure)
          : Promise.resolve(failing);
      });
      const log = vi
        .spyOn(console, "error")
        .mockImplementation(() => undefined);

      await logs.rows(["a", "b"], { limit: 10, offset: 0 });

      expect(log).toHaveBeenCalledOnce();
      const line = String(log.mock.calls[0]?.[0]);
      expect(line).toContain('"b"');
      expect(line).toContain("Access denied for user 'blocky'@'10.0.0.2'");
      expect(line).toContain("ER_ACCESS_DENIED_ERROR");
      expect(line).not.toContain("hunter2");
      expect(line).not.toContain("db.internal");
    },
  );

  it.each([
    "http://blocky:hunter 2\n@b/c@127.0.0.1:9428",
    "http:/blocky:hunter2@127.0.0.1:9428",
    "HTTP:\\\\blocky:hunter2@127.0.0.1:9428",
    "http://blocky:hunter%40:2@127.0.0.1:9428",
  ])("hides the credentials VictoriaLogs echoes from %j", async (target) => {
    const configuration = parseConfiguration({
      servers: { a: { url: "http://a", logs: { source: "a" } } },
      logSources: {
        a: { type: "console", consoleProvider: "victorialogs", target },
      },
    });
    const log = vi.spyOn(console, "error").mockImplementation(() => undefined);

    await createLogCoordinator(configuration).rows(["a"], {
      limit: 10,
      offset: 0,
    });

    const line = String(log.mock.calls[0]?.[0]);
    expect(line).toContain("credentials:");
    expect(line).toContain("127.0.0.1:9428");
    expect(line).not.toContain("hunter");
  });

  it("keeps the reason when a CSV path contains @", async () => {
    const configuration = parseConfiguration({
      servers: { a: { url: "http://a", logs: { source: "a" } } },
      logSources: { a: { type: "csv", target: "/missing/logs@nas" } },
    });
    const log = vi.spyOn(console, "error").mockImplementation(() => undefined);

    await createLogCoordinator(configuration).rows(["a"], {
      limit: 10,
      offset: 0,
    });

    expect(String(log.mock.calls[0]?.[0])).toContain(
      "no such file or directory, scandir '/missing/logs@nas'",
    );
  });

  it("hides the password of a structured target when an error repeats it", async () => {
    const configuration = parseConfiguration({
      servers: { a: { url: "http://a", logs: { source: "a" } } },
      logSources: {
        a: {
          type: "mysql",
          target: {
            host: "db",
            username: "blocky",
            password: "hunter2",
            database: "blocky",
          },
        },
      },
    });
    const logs = createLogCoordinator(configuration, () =>
      Promise.reject(new Error("Bad option password=hunter2 for blocky@db")),
    );
    const log = vi.spyOn(console, "error").mockImplementation(() => undefined);

    await logs.rows(["a"], { limit: 10, offset: 0 });

    expect(String(log.mock.calls[0]?.[0])).toContain(
      "Bad option password=<hidden> for blocky@db",
    );
  });

  it("hides the password of a multi-host PostgreSQL URL", async () => {
    const configuration = parseConfiguration({
      servers: { a: { url: "http://a", logs: { source: "a" } } },
      logSources: {
        a: {
          type: "postgresql",
          target: "postgres://blocky:hunter%402@db1:5432,db2:5432/logs",
        },
      },
    });
    const logs = createLogCoordinator(configuration, () =>
      Promise.reject(new Error("Rejected hunter@2 (sent as hunter%402)")),
    );
    const log = vi.spyOn(console, "error").mockImplementation(() => undefined);

    await logs.rows(["a"], { limit: 10, offset: 0 });

    expect(String(log.mock.calls[0]?.[0])).toContain(
      "Rejected <hidden> (sent as <hidden>)",
    );
  });

  it("hides the password URL parsing reads from a target with a tab in it", async () => {
    const configuration = parseConfiguration({
      servers: { a: { url: "http://a", logs: { source: "a" } } },
      logSources: {
        a: { type: "mysql", target: "mysql://blocky:hunt\ter2@db/blocky" },
      },
    });
    const logs = createLogCoordinator(configuration, () =>
      Promise.reject(new Error("Rejected password hunter2")),
    );
    const log = vi.spyOn(console, "error").mockImplementation(() => undefined);

    await logs.rows(["a"], { limit: 10, offset: 0 });

    expect(String(log.mock.calls[0]?.[0])).toContain(
      "Rejected password <hidden>",
    );
  });
});
