---
"blocky-ui": patch
---

Dramatically improve MySQL-backed dashboard performance on large query log tables

Statistics queries that could take tens of seconds now complete in sub-second time in typical cases. This makes the initial dashboard load, top domains, top clients, queries-over-time, and adjacent page prefetches much faster when using `QUERY_LOG_TYPE=mysql`.

#### Before and After

Measured locally against a large MySQL query log table:

| Query | Before | After |
| --- | ---: | ---: |
| Top Clients | ~60s | ~500ms |
| Top Domains | ~20s | ~650ms |
| Queries Over Time | ~6s | ~400ms |
| Overview | ~5s | ~500ms |
| Initial dashboard data load | ~70s | ~1s |
