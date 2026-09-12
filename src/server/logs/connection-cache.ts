export function cachedConnection<T>(
  key: string,
  cache: Map<string, T> | undefined,
  create: () => T,
): T {
  const existing = cache?.get(key);

  if (existing) {
    return existing;
  }

  const connection = create();
  cache?.set(key, connection);

  return connection;
}
