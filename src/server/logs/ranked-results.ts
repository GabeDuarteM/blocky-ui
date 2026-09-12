import { promisify } from "node:util";
import { deflate, inflate } from "node:zlib";
import { z } from "zod";
import { mapConcurrent } from "~/server/utils/map-concurrent";

const compress = promisify(deflate);
const decompress = promisify(inflate);
const BLOCK_SIZE = 512;
const entrySchema = z.object({
  name: z.string(),
  count: z.number(),
  blocked: z.number(),
  percentage: z.number(),
});
const blockSchema = z.array(entrySchema);

async function decode(block: Buffer) {
  const json: unknown = JSON.parse((await decompress(block)).toString());

  return blockSchema.parse(json);
}

export async function createRankedResults(
  items: z.infer<typeof entrySchema>[],
) {
  const blocks = await mapConcurrent(
    Array.from(
      { length: Math.ceil(items.length / BLOCK_SIZE) },
      (_, index) => index,
    ),
    4,
    (index) =>
      compress(
        JSON.stringify(
          items.slice(index * BLOCK_SIZE, (index + 1) * BLOCK_SIZE),
        ),
      ),
  );

  return rankedResults(blocks, items.length);
}

function rankedResults(blocks: Buffer[], totalCount: number) {
  return {
    totalCount,
    bytes: blocks.reduce((sum, block) => sum + block.byteLength + 64, 0),

    async page(offset: number, limit: number) {
      const first = Math.floor(offset / BLOCK_SIZE);
      const selected = blocks.slice(
        first,
        Math.ceil((offset + limit) / BLOCK_SIZE),
      );
      const pages = await mapConcurrent(selected, 4, decode);
      const start = offset % BLOCK_SIZE;

      return pages.flat().slice(start, start + limit);
    },

    async search(query: string, limit: number) {
      const matches: z.infer<typeof entrySchema>[] = [];
      const lower = query.toLowerCase();

      for (const block of blocks) {
        const items = await decode(block);
        matches.push(
          ...items
            .filter((item) => item.name.toLowerCase().includes(lower))
            .slice(0, limit - matches.length),
        );

        if (matches.length >= limit) {
          break;
        }
      }

      return matches;
    },
  };
}
