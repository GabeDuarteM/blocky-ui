import type { LogEntry, LogProvider } from "./types";

/**
 * Demo log provider that uses mock data.
 * Used when DEMO_MODE is enabled
 */
export class DemoLogProvider implements LogProvider {
  async getQueryLogs(options: {
    limit: number;
    offset: number;
    search?: string;
    responseType?: string;
  }): Promise<{ items: LogEntry[]; totalCount: number }> {
    const { logEntryMock } = await import("~/mocks/logEntryMock");

    let filteredLogs = logEntryMock.sort((item1, item2) => {
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
}
