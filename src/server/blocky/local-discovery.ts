/**
 * Local service-discovery and special-use domains.
 *
 * These dominate the top-domain lists on a home network without saying anything
 * useful: Apple devices probe NAT64 support via `ipv4only.arpa`, browse services
 * via `lb._dns-sd._udp.<searchdomain>`, and every reverse lookup lands under
 * `.arpa`. They are normal traffic, not a signal.
 *
 * Matching is on the query name only. Counts in the summary are untouched — this
 * hides rows from the top lists, it does not change what was resolved.
 */

/** Suffixes matched against the full query name, case-insensitively. */
export const SPECIAL_USE_SUFFIXES = [
  ".arpa", // in-addr.arpa, ip6.arpa, ipv4only.arpa (RFC 6761, RFC 7050)
  ".localhost", // RFC 6761
  ".localdomain", // common DHCP default, not standardised
];

/*
 * `.local` is deliberately NOT here. RFC 6762 reserves it for mDNS, but plenty of
 * networks use it as an internal TLD, and those names are the ones an operator
 * most wants to see. Hiding them would remove real infrastructure from the list.
 */

/**
 * DNS-SD service labels (RFC 6763). Matched anywhere in the name, because the
 * suffix is whatever search domain DHCP handed out:
 *   lb._dns-sd._udp.2.0.192.in-addr.arpa
 *   _dns-push-tls._tcp.ipv4only.arpa
 */
export const SERVICE_LABELS = ["._tcp.", "._udp."];

/** Bare names with no dot that are still local-only. */
export const BARE_LOCAL_NAMES = ["localhost", "localdomain"];

export function isLocalDiscoveryDomain(name: string): boolean {
  const value = name.toLowerCase().replace(/\.$/, "");

  if (SPECIAL_USE_SUFFIXES.some((suffix) => value.endsWith(suffix))) {
    return true;
  }

  // Also catch a bare label, e.g. "localhost" with no dot.
  if (BARE_LOCAL_NAMES.includes(value)) {
    return true;
  }

  return SERVICE_LABELS.some((label) => value.includes(label));
}

export function withoutLocalDiscoveryDomains<T extends { name: string }>(
  entries: T[],
): T[] {
  return entries.filter((entry) => !isLocalDiscoveryDomain(entry.name));
}

/**
 * Escape LIKE metacharacters so a pattern matches literally.
 *
 * `_` matches any single character and `%` any sequence, and the DNS-SD labels
 * contain `_`. Paired with `ESCAPE '!'` at the call site.
 */
export function escapeLikePattern(value: string): string {
  return value.replace(/[!%_]/g, (character) => `!${character}`);
}
