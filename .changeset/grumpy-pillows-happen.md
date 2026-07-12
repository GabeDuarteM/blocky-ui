---
"blocky-ui": major
---

Replace Prometheus-backed overview statistics with Blocky's statistics API and add rolling 24-hour top lists for installations without query logging.

#### Blocky statistics

BlockyUI now reads various statistics from Blocky's `/api/stats` endpoint, instead of requiring a prometheus integration and reading from it. Query logging remains optional and continues to provide longer time ranges, filtering, pagination, and detailed query logs when configured.

Without query logging, the statistics API provides rolling 24-hour Top Domains with All and Blocked views, plus Top Clients.

Overview total queries, outcomes, cache hit rate, and average response time now use Blocky's rolling 24-hour statistics.

![Statistics overview](https://i.imgur.com/SYJvGfe.png)

#### Breaking changes

BlockyUI no longer queries Prometheus for dashboard statistics, and the `PROMETHEUS_PATH` environment variable has been removed. Installations that only expose Prometheus metrics, run a Blocky version older than v0.33.0, or do not enable Blocky's statistics API will no longer display the Overview cards or fallback Top Lists.

To migrate, upgrade to Blocky v0.33.0 or newer and enable statistics:

```yaml
statistics:
  enable: true
```
