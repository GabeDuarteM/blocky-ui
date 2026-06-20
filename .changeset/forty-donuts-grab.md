---
"blocky-ui": patch
---

Fix SQLite query log support in armv6 and armv7 Docker images.

The Docker build now compiles the `better-sqlite3` native addon for each target runtime platform before copying it into the final image, so SQLite query logs work on 32-bit ARM images.
