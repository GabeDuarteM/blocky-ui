import { hashKey } from "@tanstack/react-query";
import type { TRPCQueryKey } from "@trpc/tanstack-react-query";

function hashWithout(input: unknown, fields: ReadonlySet<string>) {
  if (typeof input !== "object" || input === null) {
    return null;
  }

  return hashKey([
    Object.fromEntries(
      Object.entries(input).filter(([field]) => !fields.has(field)),
    ),
  ]);
}

export function keepDataWhenOnlyChanged<TInput extends object>(
  input: TInput,
  changing: (keyof TInput & string)[],
) {
  const fields = new Set<string>(changing);
  const scope = hashWithout(input, fields);

  return <TData>(
    previous: TData | undefined,
    previousQuery: { queryKey: TRPCQueryKey } | undefined,
  ) =>
    previousQuery &&
    hashWithout(previousQuery.queryKey[1]?.input, fields) === scope
      ? previous
      : undefined;
}
