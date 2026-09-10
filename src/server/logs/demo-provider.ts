import { type TimeRange } from "~/lib/constants";
import type {
  LogEntry,
  StatsResult,
  QueryLogsOptions,
  QueryLogsResult,
} from "./types";
import { aggregateStats24h, getTimeRangeConfig } from "./aggregation-utils";
import { BaseMemoryLogProvider } from "./base-provider";

/**
 * Demo log provider that uses mock data.
 * Used when DEMO_MODE is enabled
 */
export class DemoLogProvider extends BaseMemoryLogProvider {
  async getQueryLogs(options: QueryLogsOptions): Promise<QueryLogsResult> {
    const { logEntryMock } = await import("~/mocks/logEntryMock");

    let filteredLogs = logEntryMock.toSorted((item1, item2) => {
      const date1 = new Date(item1.requestTs ?? 0);
      const date2 = new Date(item2.requestTs ?? 0);

      if (date1 > date2) return -1;
      if (date1 < date2) return 1;

      return 0;
    });

    if (options.search) {
      filteredLogs = filteredLogs.filter((log) =>
        log.questionName?.toLowerCase().includes(options.search!.toLowerCase()),
      );
    }

    if (options.responseType) {
      filteredLogs = filteredLogs.filter(
        (log) => log.responseType === options.responseType,
      );
    }

    if (options.client) {
      filteredLogs = filteredLogs.filter((log) =>
        log.clientName?.toLowerCase().includes(options.client!.toLowerCase()),
      );
    }

    if (options.questionType) {
      filteredLogs = filteredLogs.filter(
        (log) => log.questionType === options.questionType,
      );
    }

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

  async getStats24h(): Promise<StatsResult> {
    const { logEntryMock } = await import("~/mocks/logEntryMock");
    return aggregateStats24h(logEntryMock);
  }

  protected async fetchEntriesInRange(range: TimeRange): Promise<LogEntry[]> {
    const { logEntryMock } = await import("~/mocks/logEntryMock");
    const { startTime } = getTimeRangeConfig(range);

    return logEntryMock.filter((log) => {
      const logDate = new Date(log.requestTs ?? 0);
      return logDate >= startTime;
    });
  }

  // Override to bypass caching - demo provider should always return fresh mock data
  protected getEntriesInRange(range: TimeRange): Promise<LogEntry[]> {
    return this.fetchEntriesInRange(range);
  }
}
