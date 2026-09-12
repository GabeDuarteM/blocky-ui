import { expect, it } from "vitest";
import {
  fingerprint,
  recordSchema,
  timestamp,
  transformRecord,
} from "../record";

const record = recordSchema.parse({
  requestTs: "2026-08-10T16:53:58.492Z",
  clientIp: "192.0.2.1",
  clientName: "laptop",
  durationMs: 0,
  reason: "CUSTOMDNS",
  responseType: "CUSTOMDNS",
  questionType: "A",
  questionName: "example.test",
  effectiveTldp: "example.test",
  answer: "A (192.0.2.42)",
  responseCode: "NOERROR",
  hostname: "blocky",
});

it("normalizes native SQL timestamps and applies explicit source offsets", () => {
  expect(timestamp("2026-08-10 18:53:58.492", "+02:00")).toBe(record.requestTs);
  expect(timestamp("2026-08-10 16:53:58.492+00")).toBe(record.requestTs);
  expect(timestamp("2026-08-10 16:53:58.492+00:00")).toBe(record.requestTs);
  expect(() => timestamp("invalid")).toThrow("timestamp");
});

it("fingerprints event multiplicity independently of database order or IDs", () => {
  const a = fingerprint();
  const b = fingerprint();
  const other = { ...record, answer: null };
  for (const value of [record, record, other]) {
    a.add(value);
  }
  for (const value of [other, record, record]) {
    b.add(value);
  }
  expect(a.result()).toEqual(b.result());
  b.add(record);
  expect(a.result()).not.toEqual(b.result());
});

it("shifts timestamps and hostnames only when requested", () => {
  expect(transformRecord(record, { shiftMs: 0 })).toEqual(record);
  expect(
    transformRecord(record, { shiftMs: 3600000, hostname: "second" }),
  ).toEqual({
    ...record,
    requestTs: "2026-08-10T17:53:58.492Z",
    hostname: "second",
  });
});
