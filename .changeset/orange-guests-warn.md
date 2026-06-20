---
"blocky-ui": patch
---

Fix SQLite query log support in Docker images. Fixes #342

The Docker build now installs dependencies in a Node-based builder so the `better-sqlite3` native module matches the Node runtime used by the production image.
