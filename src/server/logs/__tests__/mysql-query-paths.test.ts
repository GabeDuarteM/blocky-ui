import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createConnection } from "mysql2/promise";
import { makeEntry, setupMysql } from "./setup";

const rowCount = 70_000;
const timestamp = Date.now() - rowCount * 1000;
const hostnames = ["nas", "NAS", "nás", "nas ", "", null];
const sparseIds = [1, 2, 3, 4, rowCount - 1, rowCount];
let fixture: Awaited<ReturnType<typeof setupMysql>>;

beforeAll(async () => {
  fixture = await setupMysql(
    Array.from({ length: rowCount }, (_, index) =>
      makeEntry({
        requestTs: new Date(timestamp + index * 1000).toISOString(),
        questionName: sparseIds.includes(index + 1)
          ? "sparse.test"
          : "dense.test",
        hostname: hostnames[index % hostnames.length],
      }),
    ),
  );
}, 120_000);

afterAll(async () => {
  await fixture?.provider.close();
  await fixture?.container.stop();
}, 30_000);

describe("MySQL query paths with retained history", () => {
  it("excludes only exact hostnames from rows, counts and aggregations", async () => {
    const excludedHostnames = ["nas"];
    const expected = rowCount - Math.ceil(rowCount / hostnames.length);
    const scope = { excludedHostnames };
    const rows = await fixture.provider.getQueryLogRows({
      ...scope,
      limit: 20,
      offset: 0,
    });

    expect(rows.map((row) => row.hostname)).toEqual(
      expect.arrayContaining(["NAS", "nás", "nas ", "", null]),
    );
    expect(rows.some((row) => row.hostname === "nas")).toBe(false);
    expect(await fixture.provider.getQueryLogCount(scope)).toBe(expected);
    expect(
      await fixture.provider.getQueryLogCountSince(scope, new Date(0)),
    ).toBe(expected);
    const top = await fixture.provider.getTopDomains({
      ...scope,
      range: "24h",
      filter: "all",
      offset: 0,
    });
    expect(top.items.reduce((total, row) => total + row.count, 0)).toBe(
      expected,
    );
    const buckets = await fixture.provider.getQueriesOverTime({
      ...scope,
      range: "24h",
    });
    expect(buckets.reduce((total, bucket) => total + bucket.total, 0)).toBe(
      expected,
    );
  });

  it("paginates dense recent matches and sparse matches spanning the recent boundary", async () => {
    const dense = await fixture.provider.getQueryLogRows({
      search: "dense.test",
      limit: 5,
      offset: 3,
    });
    expect(dense.map((row) => row.id)).toEqual([
      69_995, 69_994, 69_993, 69_992, 69_991,
    ]);
    const sparse = await fixture.provider.getQueryLogRows({
      search: "sparse.test",
      limit: 3,
      offset: 2,
    });
    expect(sparse.map((row) => row.id)).toEqual([4, 3, 2]);
    expect(
      await fixture.provider.getQueryLogCount({ search: "sparse.test" }),
    ).toBe(6);
    const deep = await fixture.provider.getQueryLogRows({
      search: "dense.test",
      limit: 3,
      offset: 65_537,
    });
    expect(deep.map((row) => row.id)).toEqual([4461, 4460, 4459]);
    expect(
      await fixture.provider.getQueryLogRows({
        search: "sparse.test",
        limit: 3,
        offset: 10,
      }),
    ).toEqual([]);
  });

  it("keeps new arrivals outside the ID snapshot for search rows and counts", async () => {
    const maxId = await fixture.provider.getQueryLogSnapshot();
    const connection = await createConnection(
      fixture.container.getConnectionUri(),
    );

    try {
      await connection.execute(
        "INSERT INTO log_entries (request_ts, question_name, hostname) VALUES (?, ?, ?)",
        [
          new Date().toISOString().replace("T", " ").replace("Z", ""),
          "sparse.test",
          "NAS",
        ],
      );
    } finally {
      await connection.end();
    }

    const filter = { search: "sparse.test", maxId };
    expect(await fixture.provider.getQueryLogCount(filter)).toBe(6);
    expect(
      await fixture.provider.getQueryLogCountSince(filter, new Date(0)),
    ).toBe(6);
    expect(
      (
        await fixture.provider.getQueryLogRows({
          ...filter,
          limit: 3,
          offset: 1,
        })
      ).map((row) => row.id),
    ).toEqual([69_999, 4, 3]);
    expect(
      await fixture.provider.getQueryLogCount({ search: "sparse.test" }),
    ).toBe(7);
  });
});
