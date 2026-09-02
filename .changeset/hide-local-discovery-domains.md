---
"blocky-ui": minor
---

Add an optional switch to hide local service-discovery and special-use domains from Query Logs and Top Domains.

Set `HIDE_LOCAL_DISCOVERY_DOMAINS=true` to offer the switch, which is on by default and can be turned off to query those names again. It matches `.arpa`, `.localhost`, `.localdomain` and DNS-SD names containing `._tcp.` or `._udp.`. Summary counts are never filtered.
