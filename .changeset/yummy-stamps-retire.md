---
"blocky-ui": minor
---

CSV history across daily log rotation

## Highlights

CSV and csv-client now read retained daily log files together. Query logs, charts, and statistics keep their history across midnight, and the 7-day and 30-day views include the available history.

Unchanged files reuse cached results to reduce repeat reads. The first load of a large history or a new filter can still take longer.
