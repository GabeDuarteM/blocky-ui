import { type DatabaseTarget } from "~/server/config/schema";

export function cachedConnection<T>(
  key: string | DatabaseTarget,
  cache: Map<string, T> | undefined,
  create: () => T,
): T {
  const cacheKey = typeof key === "string" ? key : JSON.stringify(key);
  const existing = cache?.get(cacheKey);

  if (existing) {
    return existing;
  }

  const connection = create();
  cache?.set(cacheKey, connection);

  return connection;
}
