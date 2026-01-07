---
"blocky-ui": minor
---

Add question type filter and auto-refresh toggle to query logs

#### Question Type Filter

You can now filter query logs by DNS record type (A, AAAA, CNAME, MX, etc.) using the new "Type" dropdown in the query logs view.

#### Auto-Refresh Toggle

A new toggle allows you to enable or disable automatic refresh of query logs. When enabled, logs refresh every 30 seconds. The toggle is on by default.

#### Bug Fixes

- CSV log provider errors now display in the UI instead of failing silently
