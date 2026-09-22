import type { DatabaseTarget } from "~/server/config/schema";

export function cachedConnection<T>(
  key: string | DatabaseTarget,
  cache: Map<string, T> | undefined,
  create: () => T,
): T {
  const cacheKey =
    typeof key === "string"
      ? key
      : JSON.stringify(key, (_key, value: unknown) => {
          if (value && typeof value === "object" && !Array.isArray(value)) {
            return Object.fromEntries(
              Object.entries(value).sort(([left], [right]) => {
                if (left === right) {
                  return 0;
                }
                return left < right ? -1 : 1;
              }),
            );
          }
          return value;
        });
  const existing = cache?.get(cacheKey);

  if (existing) {
    return existing;
  }

  const connection = create();
  cache?.set(cacheKey, connection);

  return connection;
}
