---
"blocky-ui": minor
---

Support reading Blocky API headers from secret files in YAML configuration, so tokens don't need to sit in plain text. Use a `file:` or `file://` prefix, like in log source targets:

```yaml
servers:
  nas:
    url: http://blocky:4000
    headers:
      Authorization: file:/run/secrets/blocky_token
```

The file contains the complete header value, such as `Bearer your-token-here`. Use `!raw` when a header value itself must start with `file:`.
