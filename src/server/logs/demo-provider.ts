import type { TimeRange } from "~/lib/constants";
import { getTimeRangeConfig } from "~/server/logs/aggregation-utils";
import { BaseMemoryLogProvider } from "~/server/logs/base-provider";
import { createFilterFn } from "~/server/logs/csv/utils";
import { isEntryInScope } from "~/server/logs/scope";
import type {
  LogEntry,
  LogScope,
  QueryLogsOptions,
  QueryLogsResult,
} from "~/server/logs/types";

/**
 * Demo log provider that uses mock data.
 * Used when DEMO_MODE is enabled
 */
export class DemoLogProvider extends BaseMemoryLogProvider {
  async getQueryLogs(options: QueryLogsOptions): Promise<QueryLogsResult> {
    const { getMockLogEntries } = await import("~/mocks/log-entry-mock");

    const filteredLogs = getMockLogEntries()
      .filter(createFilterFn(options))
      .toSorted((item1, item2) => {
        const date1 = new Date(item1.requestTs ?? 0);
        const date2 = new Date(item2.requestTs ?? 0);

        if (date1 > date2) {
          return -1;
        }
        if (date1 < date2) {
          return 1;
        }

        return 0;
      });

    const totalCount = filteredLogs.length;
    const paginatedLogs = filteredLogs.slice(
      options.offset,
      options.offset + options.limit,
    );

    return {
      items: paginatedLogs,
      totalCount,
    };
  }

  protected async fetchEntriesInRange(range: TimeRange): Promise<LogEntry[]> {
    const { getMockLogEntries } = await import("~/mocks/log-entry-mock");
    const { startTime } = getTimeRangeConfig(range);

    return getMockLogEntries().filter((log) => {
      const logDate = new Date(log.requestTs ?? 0);
      return logDate >= startTime;
    });
  }

  // Override to bypass caching - demo provider should always return fresh mock data
  protected async getEntriesInRange(
    range: TimeRange,
    scope: LogScope = {},
  ): Promise<LogEntry[]> {
    const entries = await this.fetchEntriesInRange(range);
    return entries.filter((entry) => isEntryInScope(entry, scope));
  }
}
