---
"blocky-ui": minor
---

Manage multiple Blocky servers from one dashboard, with combined statistics and query logs, independent action targets, and results for each server. Existing single-server environment configurations continue to work.

#### Dashboard and actions

- Choose which servers contribute to the overview cards, history charts, Top Lists, and query logs. Blocking, maintenance, and DNS queries each have their own target selection.
- Search the server selectors and see connection health and blocking status for each instance. Selections persist in the browser, and newly configured servers start selected. Single-server setups hide the extra selectors.
- Combine query totals and cache entries across selected servers. Calculate response times and rates from their underlying counts rather than averaging server percentages.
- Compare listed domains, allowlisted domains, and deny groups in an expandable table. The overview shows a per-server range when counts differ instead of adding potentially overlapping blocklists together.
- Enable, pause, or disable blocking across selected servers, and run cache clearing or list reloads against independent targets. Blocking Status distinguishes mixed settings and unknown states.
- Keep successful action results when another server fails. Notifications identify failed targets and offer a retry for those targets. Blocking status is refreshed before a retry and across all servers after commands.
- Run a DNS query against several servers and inspect separate, labelled result cards, including individual loading and error states, in a scrollable results area.
- Show unavailable APIs, statistics, and log sources in a shared diagnostics panel while retaining available results. Query-log history remains accessible when its Blocky API is offline.

![Multi-server dashboard and server selection](https://github.com/user-attachments/assets/805ab97c-0fe0-45c3-80fa-f4d6ac1a1036)

![DNS query results from multiple servers](https://github.com/user-attachments/assets/d14b6b66-349f-4326-a45e-7320cb3729e5)

#### Configuration

Set `BLOCKY_UI_CONFIG=/config/blocky-ui.yml` to load a YAML configuration. For example, two servers writing to the same MySQL database can share one log source:

```yaml
servers:
  home:
    name: Home
    url: http://blocky-home:4000
    logs:
      source: history
      hostname: blocky-home
  office:
    name: Office
    url: http://blocky-office:4000
    logs:
      source: history
      hostname: blocky-office

logSources:
  history:
    type: mysql
    target: mysql://blocky:change-me@database:3306/blocky
```

Mount the file read-only in Docker and restart Blocky UI after editing it. Keep server IDs stable to preserve saved selections. Each server can have its own authentication `headers`, and its log source is optional.

The YAML file replaces `BLOCKY_API_URL`, `BLOCKY_REQUEST_HEADERS`, and `QUERY_LOG_*` settings. Without `BLOCKY_UI_CONFIG`, those environment variables continue to work. API URLs, authentication headers, and log credentials remain server-side.

Use separate or shared sources of any supported type: MySQL, PostgreSQL, Timescale, SQLite, CSV, per-client CSV, or console logs through VictoriaLogs. Console sources require `type: console` and `consoleProvider: victorialogs`.

Point each API URL directly at its Blocky instance. Instances sharing Redis may propagate blocking changes through Blocky's own synchronization, even when only one is targeted in the UI.

#### Combined query history

Query logs merge into one chronological, paginated list with server attribution, filtering, and auto-refresh. Charts, domain/client rankings, and filter suggestions use the same server selection.

Configure each shared log store once and reference its source ID from the relevant servers to avoid counting that store repeatedly. Use Blocky's recorded `hostname` to identify each server, or its `instance` field for VictoriaLogs. Records belonging to deselected servers are excluded when they can be identified. Unmapped records remain visible as Unknown, including in aggregates. Independent copies of a database count as separate histories.

#### Query performance and provider fixes

- Load query-log rows independently of the total count, so a slow count no longer holds up the table. Reuse counts and history aggregates for 30 seconds, with bounded caches and limited parallel requests to sources.
- Improve deep SQL pagination by locating row IDs before fetching full records. Optimize MySQL domain searches, client filters, and long-range Top Clients queries using existing indexes. No schema changes or new indexes are required in Blocky's databases.
- Use deterministic ordering for logs with matching timestamps and normalize timestamps for consistent ordering and display across providers.
- Align chart buckets across database, CSV, and console sources, including the current bucket.
- Parse Blocky's quoted, tab-separated CSV records correctly, including embedded tabs and line breaks.
- Escape special characters in VictoriaLogs searches so quotes, backslashes, and other regular-expression characters are treated as literal input.

#### Development tools

Switch between 1, 2, 3, 5, and 10 servers from the demo configuration dropdown, independently of the existing service toggles.

Add `bun run log-data` to export a read-only MySQL/MariaDB snapshot, verify it, and import it into disposable MySQL, PostgreSQL, Timescale, SQLite, CSV, per-client CSV, or VictoriaLogs stores. Console JSON output is also supported. Imports can preserve original timestamps or shift the dataset into a current time window, and can override hostnames for test scenarios. SQL destinations must be empty and initialized by Blocky; the tool does not create tables or indexes. See `scripts/log-data/README.md` for commands and format limitations.

Keep database connections across development hot reloads while allowing coordinator and provider code to update, without restarting the development server or interrupting active reads.
