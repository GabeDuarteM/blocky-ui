import { mock } from "node:test";

mock.timers.enable({
  apis: ["Date"],
  now: Date.UTC(2026, 0, 15, 12),
});

await import("next/dist/bin/next");
