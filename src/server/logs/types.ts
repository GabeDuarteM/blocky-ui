export interface LogEntry {
  requestTs: string | null;
  clientIp: string | null;
  clientName: string | null;
  durationMs: number | null;
  reason: string | null;
  questionName: string | null;
  answer: string | null;
  responseCode: string | null;
  responseType: string | null;
  questionType: string | null;
  hostname: string | null;
  effectiveTldp: string | null;
  id: number | null;
}

export interface LogProvider {
  getQueryLogs(options: {
    limit: number;
    offset: number;
    search?: string;
    responseType?: string;
  }): Promise<{
    items: LogEntry[];
    totalCount: number;
  }>;
}
