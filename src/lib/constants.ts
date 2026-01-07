export const BLOCKY_DNS_RECORD_TYPES = [
  "A",
  "AAAA",
  "CNAME",
  "MX",
  "TXT",
] as const;
export type DnsRecordType = (typeof BLOCKY_DNS_RECORD_TYPES)[number];

export function isDnsRecordType(value: string): value is DnsRecordType {
  return BLOCKY_DNS_RECORD_TYPES.includes(value as DnsRecordType);
}

/**
 * Blocky DNS response types indicating how a query was handled.
 * Sorted by most common first.
 *
 * - RESOLVED: Query was resolved by an external upstream DNS server
 * - BLOCKED: Query was blocked by a blocklist
 * - CACHED: Response was served from Blocky's internal cache
 * - CONDITIONAL: Resolved by conditional upstream (e.g., different DNS for internal domains)
 * - CUSTOMDNS: Resolved by a custom DNS rule defined in Blocky's config
 * - HOSTSFILE: Resolved from a hosts file (e.g., /etc/hosts)
 * - SPECIAL: Resolved by special-use domain resolver (e.g., .local, .localhost)
 * - FILTERED: Query was filtered by query type (e.g., blocking all AAAA records)
 * - NOTFQDN: Query was rejected because it wasn't a fully qualified domain name
 */
export const BLOCKY_RESPONSE_TYPES = [
  "RESOLVED",
  "BLOCKED",
  "CACHED",
  "CONDITIONAL",
  "CUSTOMDNS",
  "HOSTSFILE",
  "SPECIAL",
  "FILTERED",
  "NOTFQDN",
] as const;

export const TIME_RANGES = ["1h", "24h", "7d", "30d"] as const;
export type TimeRange = (typeof TIME_RANGES)[number];
