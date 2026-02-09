---
"blocky-ui": minor
---

Add PostgreSQL and TimescaleDB query log support

#### Configuration

Set `QUERY_LOG_TYPE` to `postgresql` or `timescale` and `QUERY_LOG_TARGET` to a PostgreSQL connection URI:

```env
QUERY_LOG_TYPE=postgresql
QUERY_LOG_TARGET=postgresql://username:password@localhost:5432/blocky_query_log
