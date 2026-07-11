import { http, HttpResponse } from "msw";
import { env } from "~/env";

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
  http.get(`${env.BLOCKY_API_URL}/api/blocking/status`, () => {
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

  http.get(`${env.BLOCKY_API_URL}/api/blocking/enable`, () => {
    blockingState = {
      enabled: true,
      autoEnableInSec: 0,
      disabledGroups: [],
    };
    return new HttpResponse(null, { status: 200 });
  }),

  http.get(`${env.BLOCKY_API_URL}/api/blocking/disable`, ({ request }) => {
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

  http.post(`${env.BLOCKY_API_URL}/api/query`, () => {
    return HttpResponse.json<QueryResult>({
      reason: "MOCK",
      response: "93.184.216.34",
      responseType: "RESOLVED",
      returnCode: "NOERROR",
    });
  }),

  http.post(`${env.BLOCKY_API_URL}/api/cache/flush`, () => {
    return new HttpResponse(null, { status: 200 });
  }),

  http.post(`${env.BLOCKY_API_URL}/api/lists/refresh`, () => {
    return new HttpResponse(null, { status: 200 });
  }),

  http.get(`${env.BLOCKY_API_URL}/api/stats`, () => {
    const end = new Date();
    const start = new Date(end.getTime() - 24 * 60 * 60 * 1000);

    return HttpResponse.json({
      start: start.toISOString(),
      end: end.toISOString(),
      summary: {
        queries: 12453,
        cached: 8976,
        forwarded: 1343,
        blocked: 2134,
        local: 0,
        dropped: 0,
        errors: 0,
        avgResponseMs: 12,
        cacheHitRate: 0.87,
      },
      byResponseType: {
        BLOCKED: 2134,
        CACHED: 8976,
        RESOLVED: 1343,
      },
      byQueryType: { A: 9000, AAAA: 3453 },
      byResponseCode: { NOERROR: 12453 },
      perHour: [],
      topDomains: [
        { name: "connectivitycheck.gstatic.com", count: 842 },
        { name: "api.github.com", count: 613 },
        { name: "registry.npmjs.org", count: 487 },
        { name: "home-assistant.io", count: 321 },
        { name: "time.cloudflare.com", count: 284 },
      ],
      topBlockedDomains: [
        { name: "telemetry.microsoft.com", count: 312 },
        { name: "ads.google.com", count: 268 },
        { name: "graph.facebook.com", count: 194 },
        { name: "tracking.example.com", count: 143 },
        { name: "metrics.example.net", count: 97 },
      ],
      topClients: [
        { name: "living-room", count: 3201 },
        { name: "nas", count: 2740 },
        { name: "laptop", count: 2388 },
        { name: "home-assistant", count: 1984 },
        { name: "phone", count: 1527 },
      ],
      lists: {
        denylist: { default: 86832, ads: 42156, malware: 12543 },
        allowlist: { default: 156, ads: 89 },
      },
      cache: { entries: 4521 },
    });
  }),
];
