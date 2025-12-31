---
"blocky-ui": minor
---

Add client filtering for query logs and support for CSV per-client log format

#### Filter Query Logs by Client

You can now filter query logs by client name in addition to domain. The search box shows suggestions for both domains and clients with their query counts.

![Filter by domain or client](https://i.imgur.com/pArfERS.png)

#### CSV Per-Client Log Format Support

Added support for Blocky's `csv-client` logging format, which stores logs in separate files per client.

To enable, set in your environment:

```bash
QUERY_LOG_TYPE=csv-client
QUERY_LOG_TARGET=/path/to/blocky/logs/folder/
```
