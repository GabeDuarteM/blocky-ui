---
"blocky-ui": minor
---

CSV history across daily log rotation

## Highlights

Previously, CSV and csv-client only showed the latest day's logs. Query logs and charts reset at midnight, and the 7-day and 30-day views could not show older activity. They now include the full history, including previous days as long as those log files are still available.

We also improved CSV performance on the first load, before any results are cached. Later requests can reuse results from files that haven't changed, reducing repeat reads.
