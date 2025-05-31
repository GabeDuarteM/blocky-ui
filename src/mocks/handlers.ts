import { http, HttpResponse } from "msw";

interface BlockingStatus {
  enabled: boolean;
  autoEnableInSec: number;
  disabledGroups: string[];
}

interface QueryRequest {
  query: string;
  type: string;
}

interface QueryResult {
  reason: string;
  response: string;
  responseType: string;
  returnCode: string;
}

export const handlers = [
  http.get("http://localhost:4000/api/blocking/status", () => {
    return HttpResponse.json<BlockingStatus>({
      enabled: true,
      autoEnableInSec: 0,
      disabledGroups: [],
    });
  }),

  http.get("http://localhost:4000/api/blocking/enable", () => {
    return new HttpResponse(null, { status: 200 });
  }),

  http.get("http://localhost:4000/api/blocking/disable", () => {
    return new HttpResponse(null, { status: 200 });
  }),

  http.post("http://localhost:4000/api/query", async ({ request }) => {
    const body = (await request.json()) as QueryRequest;
    return HttpResponse.json<QueryResult>({
      reason: "MOCK",
      response: "93.184.216.34",
      responseType: "RESOLVED",
      returnCode: "NOERROR",
    });
  }),

  http.post("http://localhost:4000/api/cache/flush", () => {
    return new HttpResponse(null, { status: 200 });
  }),

  http.post("http://localhost:4000/api/lists/refresh", () => {
    return new HttpResponse(null, { status: 200 });
  }),
];
