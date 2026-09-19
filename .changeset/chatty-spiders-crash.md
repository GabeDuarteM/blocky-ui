---
"blocky-ui": minor
---

File references in more database fields

## Highlights

Extend `file:` and `file://` support to host, username, database, and strings inside driver options, including arrays. TLS certificates and keys can now be loaded from mounted files instead of written inline.

For example, inside a database target:

```yaml
options:
  ssl:
    ca: file:/run/secrets/db_ca.pem
    cert: file:/run/secrets/db_cert.pem
    key: file:/run/secrets/db_key.pem
```

Use `!raw` as an escape hatch when a string should reach the database driver unchanged, such as a SQLite file URI:

```yaml
logSources:
  home:
    type: sqlite
    target: !raw "file:/logs/blocky.db?mode=ro"
```
