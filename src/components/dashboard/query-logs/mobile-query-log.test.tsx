const summaryPattern = /<summary[\s\S]*?<\/summary>/;
const clientAddressPattern = /192\.168\.1\.25/g;

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { MobileQueryLog } from "~/components/dashboard/query-logs/mobile-query-log";
import { getMockLogEntries } from "~/mocks/log-entry-mock";
import type { LogEntry } from "~/server/logs/types";

function renderLog(overrides: Partial<LogEntry>, showServer = false) {
  const [sample] = getMockLogEntries();
  if (!sample) {
    throw new Error("The query log fixture is empty");
  }
  return renderToStaticMarkup(
    createElement(MobileQueryLog, {
      entry: { ...sample, ...overrides },
      showServer,
    }),
  );
}

describe("mobile query log details", () => {
  it("keeps full domain, client, source, and reason context available inline", () => {
    const domain =
      "a-very-long-subdomain.with-another-long-segment.example.com";
    const html = renderLog(
      {
        questionName: domain,
        clientName: "Living room television",
        clientIp: "192.168.1.25",
        hostname: "Home resolver",
        reason: "BLOCKED (advertising)",
        responseType: "BLOCKED",
      },
      true,
    );

    expect(html).toContain(domain);
    expect(html).toContain("Living room television");
    expect(html).toContain("192.168.1.25");
    expect(html).toContain("Home resolver");
    expect(html).toContain("Group: advertising");
    expect(html).toContain("<details");
    expect(html.match(summaryPattern)?.[0]).not.toContain("<button");
  });

  it("does not repeat the client IP or include a hidden source column", () => {
    const html = renderLog({
      clientName: "192.168.1.25",
      clientIp: "192.168.1.25",
      hostname: "Hidden resolver",
    });
    expect(html.match(clientAddressPattern)).toHaveLength(1);
    expect(html).not.toContain("Hidden resolver");
  });

  it("renders missing fields without inventing a result or timestamp", () => {
    const html = renderLog({
      questionName: null,
      clientName: null,
      clientIp: null,
      requestTs: null,
      questionType: null,
      durationMs: null,
      reason: null,
      responseType: null,
    });
    expect(html).toContain("Unknown domain");
    expect(html).toContain("Unknown client");
    expect(html).toContain("Unknown time");
    expect(html).not.toContain("Invalid Date");
    expect(html).not.toContain("Resolved by:");
  });
});
