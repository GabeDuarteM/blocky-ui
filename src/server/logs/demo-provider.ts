import { type TimeRange } from "~/lib/constants";
import type {
  LogEntry,
  LogProvider,
  StatsResult,
  QueriesOverTimeEntry,
  TopDomainEntry,
  TopClientEntry,
  QueryTypeEntry,
  SearchDomainEntry,
  SearchClientEntry,
} from "./types";
import {
  getTimeRangeConfig,
  aggregateQueriesOverTime,
  aggregateTopDomains,
  aggregateTopClients,
  aggregateQueryTypes,
  searchDomainsInEntries,
  searchClientsInEntries,
} from "./aggregation-utils";

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
    client?: string;
  }): Promise<{ items: LogEntry[]; totalCount: number }> {
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
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const recentLogs = logEntryMock.filter((log) => {
      const logDate = new Date(log.requestTs ?? 0);
      return logDate >= oneDayAgo;
    });

    const blocked = recentLogs.filter(
      (log) => log.responseType === "BLOCKED",
    ).length;

    return {
      totalQueries: recentLogs.length,
      blocked,
    };
  }

  private async getEntriesInRange(range: TimeRange): Promise<LogEntry[]> {
    const { logEntryMock } = await import("~/mocks/logEntryMock");
    const { startTime } = getTimeRangeConfig(range);

    return logEntryMock.filter((log) => {
      const logDate = new Date(log.requestTs ?? 0);
      return logDate >= startTime;
    });
  }

  async getQueriesOverTime(options: {
    range: TimeRange;
    domain?: string;
    client?: string;
  }): Promise<QueriesOverTimeEntry[]> {
    let entries = await this.getEntriesInRange(options.range);

    if (options.domain) {
      const domainLower = options.domain.toLowerCase();
      entries = entries.filter((e) =>
        e.questionName?.toLowerCase().includes(domainLower),
      );
    }

    if (options.client) {
      const clientLower = options.client.toLowerCase();
      entries = entries.filter((e) =>
        e.clientName?.toLowerCase().includes(clientLower),
      );
    }

    return aggregateQueriesOverTime(entries, options.range);
  }

  async getTopDomains(options: {
    range: TimeRange;
    limit: number;
    offset: number;
    filter: "all" | "blocked";
  }): Promise<{ items: TopDomainEntry[]; totalCount: number }> {
    let entries = await this.getEntriesInRange(options.range);
    if (options.filter === "blocked") {
      entries = entries.filter((log) => log.responseType === "BLOCKED");
    }
    return aggregateTopDomains(entries, options.limit, options.offset);
  }

  async getTopClients(options: {
    range: TimeRange;
    limit: number;
    offset: number;
    filter: "all" | "blocked";
  }): Promise<{ items: TopClientEntry[]; totalCount: number }> {
    let entries = await this.getEntriesInRange(options.range);
    if (options.filter === "blocked") {
      entries = entries.filter((log) => log.responseType === "BLOCKED");
    }
    return aggregateTopClients(entries, options.limit, options.offset);
  }

  async getQueryTypesBreakdown(range: TimeRange): Promise<QueryTypeEntry[]> {
    const entries = await this.getEntriesInRange(range);
    return aggregateQueryTypes(entries);
  }

  async searchDomains(options: {
    range: TimeRange;
    query: string;
    limit: number;
  }): Promise<SearchDomainEntry[]> {
    const entries = await this.getEntriesInRange(options.range);
    return searchDomainsInEntries(entries, options.query, options.limit);
  }

  async searchClients(options: {
    range: TimeRange;
    query: string;
    limit: number;
  }): Promise<SearchClientEntry[]> {
    const entries = await this.getEntriesInRange(options.range);
    return searchClientsInEntries(entries, options.query, options.limit);
  }
}
