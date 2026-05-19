---
"blocky-ui": minor
---

Add VictoriaLogs query log support

#### Configuration

Set `QUERY_LOG_TYPE` to `console`, `QUERY_LOG_CONSOLE_PROVIDER` to `victorialogs`, and `QUERY_LOG_TARGET` to a VictoriaLogs base URL:

```env
QUERY_LOG_TYPE=console
QUERY_LOG_CONSOLE_PROVIDER=victorialogs
QUERY_LOG_TARGET=http://victoria-logs-host:9428
```
