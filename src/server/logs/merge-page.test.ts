import { describe, expect, it } from "vitest";
import { mergePage } from "~/server/logs/merge-page";

describe("paging sorted sources", () => {
  it.each([false, true])(
    "matches a complete merge with indexed boundaries %s",
    async (indexed) => {
      for (const size of [0, 1, 2, 3, 5, 10]) {
        const groups = Array.from({ length: size }, (_, source) =>
          Array.from(
            { length: source % 3 === 0 ? 0 : 1500 + source * 113 },
            (_, index) => ({
              source,
              index,
              timestamp: Math.floor(index / 3) + source * 23,
            }),
          ),
        );
        const compare = (
          a: { timestamp: number; source: number },
          b: { timestamp: number; source: number },
        ) => a.timestamp - b.timestamp || a.source - b.source;
        const expected = groups.flat().sort(compare);
        const sources = groups.map((items) => ({
          count: async () => items.length,
          countBefore: indexed
            ? async (pivot: (typeof items)[number]) =>
                items.filter((item) => compare(item, pivot) < 0).length
            : undefined,
          read: async (offset: number, limit: number) =>
            items.slice(offset, offset + limit),
        }));

        for (const offset of [
          0,
          1,
          256,
          257,
          800,
          Math.floor(expected.length / 2),
          expected.length - 1,
          expected.length,
          expected.length + 100,
        ]) {
          const start = Math.max(0, offset);
          const page = await mergePage(
            sources,
            { offset: start, limit: 11 },
            compare,
          );

          expect(page).toEqual(expected.slice(start, start + 11));
        }
      }
    },
  );
});
