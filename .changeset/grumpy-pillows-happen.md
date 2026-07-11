---
"blocky-ui": major
---

Replace Prometheus-backed overview statistics with Blocky's statistics API and add rolling 24-hour top lists for installations without query logging.

#### Blocky statistics

BlockyUI now reads various statistics from Blocky's `/api/stats` endpoint, instead of requiring a prometheus integration and reading from it. Query logging remains optional and continues to provide longer time ranges, filtering, pagination, and detailed query logs when configured.

Enable statistics in Blocky v0.33.0 or newer:

```yaml
statistics:
  enable: true
```

#### Migration from Prometheus

Prometheus is no longer required or queried by BlockyUI. The `PROMETHEUS_PATH` environment variable has been removed. Existing installations that relied on Prometheus for the overview cards must enable Blocky's statistics configuration shown above.

![Statistics overview](https://i.imgur.com/SYJvGfe.png)
