export const BLOCKY_DNS_RECORD_TYPES = [
  "A",
  "AAAA",
  "CNAME",
  "MX",
  "TXT",
] as const;
export const BLOCKY_RESPONSE_TYPES = [
  "BLOCKED",
  "RESOLVED",
  "CACHED",
  "CUSTOMDNS",
  "SPECIAL",
] as const;

export const TIME_RANGES = ["1h", "24h", "7d", "30d"] as const;
export type TimeRange = (typeof TIME_RANGES)[number];
