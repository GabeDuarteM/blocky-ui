import { mapConcurrent } from "~/server/utils/map-concurrent";

export const MAX_PREFIX_ROWS = 256;

export async function mergePage<T>(
  sources: {
    count(): Promise<number>;
    read(offset: number, limit: number): Promise<T[]>;
    countBefore?(pivot: T): Promise<number>;
  }[],
  options: { offset: number; limit: number },
  compare: (a: T, b: T) => number,
) {
  if (sources.length === 1) {
    return sources[0]?.read(options.offset, options.limit) ?? [];
  }

  let skip = options.offset;
  const indexed = sources.every((source) => source.countBefore);
  const states = await mapConcurrent(sources, 4, async (source) => ({
    source,
    offset: 0,
    count: skip > MAX_PREFIX_ROWS && !indexed ? await source.count() : Infinity,
  }));

  function trimPrefix() {
    const total = states.reduce(
      (sum, state) => sum + Math.max(0, state.count - state.offset),
      0,
    );

    if (skip >= total) {
      return false;
    }

    const remaining = skip;

    for (const state of states) {
      const advance = Math.max(
        0,
        remaining - (total - Math.max(0, state.count - state.offset)),
      );
      state.offset += advance;
      skip -= advance;
    }

    return true;
  }

  if (skip > MAX_PREFIX_ROWS && !indexed && !trimPrefix()) {
    return [];
  }

  while (skip > Math.max(MAX_PREFIX_ROWS, sources.length)) {
    const active = states.filter((state) => state.offset < state.count);

    if (active.length === 0) {
      return [];
    }

    if (active.length === 1) {
      const state = active[0];

      if (state) {
        state.offset += skip;
        skip = 0;
      }

      break;
    }

    const step = Math.floor(skip / active.length);
    const candidates = await mapConcurrent(active, 4, async (state) => {
      const advance = Math.min(Math.max(1, step), state.count - state.offset);
      const [item] = await state.source.read(state.offset + advance - 1, 1);

      return { state, advance, item };
    });

    if (candidates.some((candidate) => candidate.item === undefined)) {
      await mapConcurrent(states, 4, async (state) => {
        state.count = await state.source.count();
      });

      if (!trimPrefix()) {
        return [];
      }

      continue;
    }

    const first = candidates
      .flatMap(({ item, ...candidate }) =>
        item === undefined ? [] : [{ ...candidate, item }],
      )
      .sort((a, b) => compare(a.item, b.item))[0];

    if (first) {
      first.state.offset += first.advance;
      skip -= first.advance;

      const advances = await mapConcurrent(candidates, 4, async (candidate) => {
        const { state } = candidate;

        if (state === first.state || !state.source.countBefore) {
          return 0;
        }

        const rowsBeforePivot = await state.source.countBefore(first.item);
        const unreadBeforePivot = Math.max(0, rowsBeforePivot - state.offset);
        const advance = Math.min(candidate.advance, unreadBeforePivot);
        state.offset += advance;

        return advance;
      });

      skip -= advances.reduce((sum, advance) => sum + advance, 0);
    }
  }

  const pages = await mapConcurrent(states, 4, (state) =>
    state.source.read(state.offset, skip + options.limit),
  );

  return pages
    .flat()
    .sort(compare)
    .slice(skip, skip + options.limit);
}
