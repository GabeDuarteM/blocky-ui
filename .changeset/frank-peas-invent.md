---
"blocky-ui": patch
---

Keep dashboard data visible during background refreshes.

Automatic query refreshes no longer replace query logs, top lists, or the queries-over-time chart with full loading states. Loading placeholders are now reserved for initial loads and uncached page or filter changes, and the queries-over-time chart uses an improved chart-shaped loading state.

![Queries over time loading state](https://i.imgur.com/hzrRhvI.png)
