---
"blocky-ui": patch
---

Match query log searches and client filters literally on MySQL, PostgreSQL and SQLite. Typing `%` or `_` used to act as a wildcard there, so `my_host` also matched `myxhost.example` and `%` matched every row. Results now match CSV and VictoriaLogs.
