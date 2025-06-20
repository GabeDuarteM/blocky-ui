import type { InferSelectModel } from "drizzle-orm";
import type { logEntries } from "~/server/db/schema";
import { faker } from "@faker-js/faker";
import { BLOCKY_DNS_RECORD_TYPES, RESPONSE_TYPES } from "~/lib/constants";

type LogEntry = InferSelectModel<typeof logEntries>;

const generateMockLogEntry = (id: number): LogEntry => {
  const responseType = faker.helpers.arrayElement(RESPONSE_TYPES);

  let reason = responseType;

  if (responseType === "BLOCKED") {
    reason += ` (ad-group)`;
  } else if (responseType === "RESOLVED") {
    reason += ` (${faker.helpers.arrayElement([
      "https://dns.google/dns-query",
      "https://cloudflare-dns.com/dns-query",
      "https://dns.quad9.net/dns-query",
    ])})`;
  }

  return {
    id,
    requestTs: faker.date.recent().toISOString(),
    clientIp: faker.internet.ipv4(),
    clientName: faker.internet.ipv4(),
    durationMs: faker.number.int({ min: 1, max: 100 }),
    reason,
    responseType,
    questionType: faker.helpers.arrayElement(BLOCKY_DNS_RECORD_TYPES),
    questionName: faker.internet.domainName(),
    effectiveTldp: null,
    answer: faker.internet.ip(),
    responseCode: "NOERROR",
    hostname: faker.internet.domainName(),
  };
};

export const logEntryMock: LogEntry[] = Array.from({ length: 50 }, (_, i) =>
  generateMockLogEntry(i + 1),
);

// void import("fs").then(({ writeFileSync }) =>
//   writeFileSync("./logEntryMocks.json", JSON.stringify(logEntryMock)),
// );
