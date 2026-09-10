---
"blocky-ui": patch
---

Fixes the Overview cards reporting only a fraction of DNS traffic when Blocky runs more than one instance.

Blocky's `/api/stats` is per-instance and held in memory: each instance counts only the queries it answered itself, and the counters reset whenever that instance restarts. Behind a load balancer the Overview therefore showed roughly one instance's share of traffic, and dropped back towards zero after every restart or redeploy.

When a query log is configured, BlockyUI now reads the Overview's total queries, blocked count, cache hit rate, and average response time from it. The query log already spans every instance and survives restarts, so the cards match the traffic Blocky actually served. Cache size and blocklist sizes continue to come from `/api/stats` — they describe current state rather than traffic, and are the same on every instance.

Installations without a query log are unaffected and continue to use `/api/stats`.
