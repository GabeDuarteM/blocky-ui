import { type LogProvider, type QueryLogsOptions } from "~/server/logs/types";

export async function readQueryLogPage(
  provider: Pick<LogProvider, "getQueryLogRows" | "getQueryLogCount">,
  options: QueryLogsOptions,
) {
  const [items, totalCount] = await Promise.all([
    provider.getQueryLogRows(options),
    provider.getQueryLogCount(options),
  ]);
  return { items, totalCount };
}
