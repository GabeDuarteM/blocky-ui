---
"blocky-ui": patch
---

Match query log searches literally on MySQL, PostgreSQL and SQLite. Searching for `%` or `_` used to act as a wildcard there, so `my_host` also matched `myxhost.example` and `%` matched every row. Results now match CSV and VictoriaLogs.
