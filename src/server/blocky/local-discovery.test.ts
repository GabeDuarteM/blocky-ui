import { describe, expect, it } from "vitest";

import {
  isLocalDiscoveryDomain,
  withoutLocalDiscoveryDomains,
} from "~/server/blocky/local-discovery";

describe("isLocalDiscoveryDomain", () => {
  it.each([
    "ipv4only.arpa",
    "2.0.192.in-addr.arpa",
    "1.0.0.0.ip6.arpa",
    "localhost",
    "db.localhost",
    "localdomain",
    "host.localdomain",
    "lb._dns-sd._udp.2.0.192.in-addr.arpa",
    "_dns-push-tls._tcp.ipv4only.arpa",
    "_companion-link._tcp.home",
    "ipv4only.arpa.",
  ])("hides %s", (name) => {
    expect(isLocalDiscoveryDomain(name)).toBe(true);
  });

  it.each([
    "example.com",
    "grafana.example.com",
    "printer.local",
    "server1.local",
    "localhost.example.com",
    "notlocal",
    "arpa.example.com",
    "my_tcp.example.com",
  ])("keeps %s", (name) => {
    expect(isLocalDiscoveryDomain(name)).toBe(false);
  });
});

describe("withoutLocalDiscoveryDomains", () => {
  it("removes only matching entries and preserves order", () => {
    expect(
      withoutLocalDiscoveryDomains([
        { name: "example.com", count: 10 },
        { name: "ipv4only.arpa", count: 900 },
        { name: "grafana.example.com", count: 5 },
      ]),
    ).toEqual([
      { name: "example.com", count: 10 },
      { name: "grafana.example.com", count: 5 },
    ]);
  });
});
