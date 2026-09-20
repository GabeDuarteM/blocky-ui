---
"blocky-ui": minor
---

CSV history across daily log rotation

## Highlights

Previously, CSV and csv-client only showed the latest day's logs. Query logs and charts reset at midnight, and the 7-day and 30-day views could not show older activity. They now include previous days as long as those log files are still available.

Unchanged files reuse cached results to reduce repeat reads. The first load of a large history or a new filter can still take longer.
