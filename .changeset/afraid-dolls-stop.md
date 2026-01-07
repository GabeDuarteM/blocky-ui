---
"blocky-ui": minor
---

Improve query logs with new filters, auto-refresh, and better duration display

#### New Filters and Auto-Refresh

You can now filter query logs by DNS record type (A, AAAA, CNAME, MX, etc.) and by all Blocky response types. A new auto-refresh toggle lets you enable or disable automatic refresh every 30 seconds.

![Query logs filters and auto-refresh toggle](https://i.imgur.com/dh4cUQR.png)

#### Duration Column

The Duration column now better indicates when no external DNS lookup was needed:

- **Dash (—)**: Locally-resolved responses with 0ms duration (cached, blocked, hosts file, etc.)
- **0ms**: Externally-resolved responses that returned instantly (e.g., due to upstream caching)
- **Xms**: Normal duration for any response that took measurable time

![Duration column showing dash for cached entries](https://i.imgur.com/ILTIDb6.png)
