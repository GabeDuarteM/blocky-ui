import { describe, expect, it } from "vitest";
import { identifyQueryLogRows } from "~/components/dashboard/query-logs/query-log-identity";
import { getMockLogEntries } from "~/mocks/log-entry-mock";

const [mockEntry] = getMockLogEntries();
if (!mockEntry) {
  throw new Error("Expected a mock query log entry");
}
const example = { ...mockEntry, sourceId: "home" };

describe("query log row identity", () => {
  it("preserves IDs when rows move or a new query arrives", () => {
    const first = { ...example, id: 1 };
    const second = { ...example, id: 2 };
    const original = identifyQueryLogRows([first, second]);
    const refreshed = identifyQueryLogRows([
      { ...example, id: 3 },
      second,
      first,
    ]);
    expect(refreshed[1]?.rowId).toBe(original[1]?.rowId);
    expect(refreshed[2]?.rowId).toBe(original[0]?.rowId);
  });

  it("distinguishes the same database ID in different sources", () => {
    const rows = identifyQueryLogRows([
      { ...example, id: 1 },
      { ...example, id: 1, sourceId: "office" },
    ]);
    expect(rows[0]?.rowId).not.toBe(rows[1]?.rowId);
  });

  it("keeps a database row's identity when display fields change", () => {
    expect(identifyQueryLogRows([{ ...example, id: 0 }])[0]?.rowId).toBe(
      identifyQueryLogRows([{ ...example, id: 0, clientName: "renamed" }])[0]
        ?.rowId,
    );
  });

  it("uses stable content for entries without database IDs", () => {
    const entry = { ...example, id: null };
    const { sourceId, ...fields } = entry;
    const reordered = { sourceId, ...fields };
    const original = identifyQueryLogRows([entry]);
    const refreshed = identifyQueryLogRows([
      { ...entry, questionName: "another.example" },
      reordered,
    ]);
    expect(refreshed[1]?.rowId).toBe(original[0]?.rowId);
    expect(refreshed[0]?.rowId).not.toBe(original[0]?.rowId);
  });

  it("keeps identical entries distinct without depending on other rows", () => {
    const entry = { ...example, id: null };
    const original = identifyQueryLogRows([entry, { ...entry }]);
    const refreshed = identifyQueryLogRows([
      { ...entry, questionName: "another.example" },
      entry,
      { ...entry },
    ]);
    expect(new Set(original.map((row) => row.rowId)).size).toBe(2);
    expect(refreshed.slice(1).map((row) => row.rowId)).toEqual(
      original.map((row) => row.rowId),
    );
  });
});
