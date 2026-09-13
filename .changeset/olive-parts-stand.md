---
"blocky-ui": minor
---

Support reading query log targets from secret files in YAML configuration. Use a `file:` or `file://` prefix instead of writing the target inline:

```yaml
logSources:
  home:
    type: mysql
    target: file:/run/secrets/query_log_target
```

The file contains the complete target value, such as a database connection URL.
