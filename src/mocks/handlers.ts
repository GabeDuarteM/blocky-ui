import { http, HttpResponse } from "msw";

interface BlockingStatus {
  enabled: boolean;
  autoEnableInSec: number;
  disabledGroups: string[];
}

interface QueryResult {
  reason: string;
  response: string;
  responseType: string;
  returnCode: string;
}

interface BlockingState extends BlockingStatus {
  disabledAt?: number;
}

let blockingState: BlockingState = {
  enabled: true,
  autoEnableInSec: 0,
  disabledGroups: [],
};

export const handlers = [
  http.get("http://localhost:4000/api/blocking/status", () => {
    if (
      !blockingState.enabled &&
      blockingState.disabledAt &&
      blockingState.autoEnableInSec > 0
    ) {
      const now = Date.now();
      const elapsedSeconds = Math.floor(
        (now - blockingState.disabledAt) / 1000,
      );
      const remainingSeconds = Math.max(
        0,
        blockingState.autoEnableInSec - elapsedSeconds,
      );

      if (remainingSeconds === 0) {
        blockingState = {
          enabled: true,
          autoEnableInSec: 0,
          disabledGroups: [],
        };
      } else {
        blockingState.autoEnableInSec = remainingSeconds;
      }
    }

    return HttpResponse.json<BlockingStatus>({
      enabled: blockingState.enabled,
      autoEnableInSec: blockingState.autoEnableInSec,
      disabledGroups: blockingState.disabledGroups,
    });
  }),

  http.get("http://localhost:4000/api/blocking/enable", () => {
    blockingState = {
      enabled: true,
      autoEnableInSec: 0,
      disabledGroups: [],
    };
    return new HttpResponse(null, { status: 200 });
  }),

  http.get("http://localhost:4000/api/blocking/disable", ({ request }) => {
    const url = new URL(request.url);
    const duration = url.searchParams.get("duration");
    const groups = url.searchParams.get("groups")?.split(",") ?? [];

    let seconds = 0;
    if (duration && duration !== "0") {
      const match = /(\d+)([smh])/.exec(duration);
      if (match) {
        const [, value, unit] = match;
        const numValue = parseInt(value ?? "0");
        switch (unit) {
          case "s":
            seconds = numValue;
            break;
          case "m":
            seconds = numValue * 60;
            break;
          case "h":
            seconds = numValue * 3600;
            break;
        }
      }
    }

    blockingState = {
      enabled: false,
      autoEnableInSec: seconds,
      disabledGroups: groups,
      disabledAt: seconds > 0 ? Date.now() : undefined,
    };

    return new HttpResponse(null, { status: 200 });
  }),

  http.post("http://localhost:4000/api/query", () => {
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
