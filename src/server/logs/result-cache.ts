export function createResultCache<T>({
  ttlMs,
  maxEntries,
  maxWeight = Infinity,
  weightOf = () => 1,
  shouldCache = () => true,
  now = Date.now,
}: {
  ttlMs: number;
  maxEntries: number;
  maxWeight?: number;
  weightOf?: (value: T) => number;
  shouldCache?: (value: T) => boolean;
  now?: () => number;
}) {
  const entries = new Map<
    string,
    { value: Promise<T>; expiresAt: number; weight: number }
  >();

  function prune() {
    let weight = [...entries.values()].reduce(
      (total, entry) => total + entry.weight,
      0,
    );
    for (const [key, entry] of entries) {
      if (entries.size <= maxEntries && weight <= maxWeight) {
        break;
      }
      weight -= entry.weight;
      entries.delete(key);
    }
  }

  return {
    get(key: string, load: () => Promise<T>): Promise<T> {
      const cached = entries.get(key);
      if (cached && cached.expiresAt > now()) {
        entries.delete(key);
        entries.set(key, cached);
        return cached.value;
      }

      const entry = {
        value: Promise.resolve().then(load),
        expiresAt: Infinity,
        weight: 0,
      };
      entries.delete(key);
      entries.set(key, entry);
      prune();
      void entry.value.then(
        (value) => {
          if (!shouldCache(value)) {
            if (entries.get(key) === entry) {
              entries.delete(key);
            }

            return;
          }

          entry.expiresAt = now() + ttlMs;
          entry.weight = weightOf(value);
          prune();
        },
        () => {
          if (entries.get(key) === entry) {
            entries.delete(key);
          }
        },
      );
      return entry.value;
    },
  };
}
