---
"blocky-ui": minor
---

Add full support for Blocky's new SQLite query log target.

#### Configuration

Set `QUERY_LOG_TYPE` to `sqlite` and `QUERY_LOG_TARGET` to the SQLite database file path used by Blocky's `queryLog.target`:

```env
QUERY_LOG_TYPE=sqlite
QUERY_LOG_TARGET=/path/to/blocky/query-log.db
```
