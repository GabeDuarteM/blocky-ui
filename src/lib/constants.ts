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
