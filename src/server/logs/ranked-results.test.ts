import { expect, it } from "vitest";
import { createRankedResults } from "~/server/logs/ranked-results";

it("preserves ranking pages and search order across compressed blocks", async () => {
  const items = Array.from({ length: 1300 }, (_, index) => ({
    name:
      index % 100 === 0 ? `café-${index}.example` : `domain-${index}.example`,
    count: 1300 - index,
    blocked: index % 3,
    percentage: ((1300 - index) / 845650) * 100,
  }));
  const results = await createRankedResults(items);

  expect(results.totalCount).toBe(items.length);

  for (const offset of [0, 511, 512, 1020, 1299, 1300, 2000]) {
    expect(await results.page(offset, 25)).toEqual(
      items.slice(offset, offset + 25),
    );
  }

  expect(await results.search("CAFÉ", 10)).toEqual(
    items.filter((item) => item.name.startsWith("café")).slice(0, 10),
  );
  expect(await results.search("missing", 10)).toEqual([]);
});
