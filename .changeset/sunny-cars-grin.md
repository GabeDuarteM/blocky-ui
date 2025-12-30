---
"blocky-ui": minor
---

**Statistics Section**

A new statistics section providing insights into your DNS queries and blocking activity.

#### Features

- **Overview Cards** - Total queries, blocked requests, cache hit rate, and listed domains

_Requires [Prometheus](https://0xerr0r.github.io/blocky/latest/configuration/#prometheus) configured on Blocky_

![Overview Cards](https://i.imgur.com/Sf2T5Kl.png)

- **Queries Over Time Chart** - Interactive chart with selectable time ranges (1h, 24h, 7d, 30d)
- **Top Domains Table** - Most queried domains with filter for blocked only
- **Top Clients Table** - Devices with the most DNS queries

_Requires [query logging](https://0xerr0r.github.io/blocky/latest/configuration/#query-logging) (MySQL or CSV)_

![Statistics Dashboard](https://i.imgur.com/NtAdFhc.png)

### Configuration

Metrics are fetched from `$BLOCKY_API_URL/metrics` by default.

```yaml
environment:
  - PROMETHEUS_PATH=/custom-path # Optional, defaults to /metrics
  - QUERY_LOG_TYPE=mysql # or csv
  - QUERY_LOG_TARGET=mysql://user:pass@host:3306/database
```
