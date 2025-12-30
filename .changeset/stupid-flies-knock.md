---
"blocky-ui": minor
---

feat: Add support for Query Logs of type "CSV"

### DEPRECATION NOTICE

To better align with the configuration schema from blocky, the `DATABASE_URL` environment variable is now deprecated and replaced by `QUERY_LOG_TYPE` and `QUERY_LOG_TARGET`.
While `DATABASE_URL` still works in this version, it will be removed in a future release.

Replace it with:

```sh
QUERY_LOG_TYPE=mysql
QUERY_LOG_TARGET=mysql://your-database
```
