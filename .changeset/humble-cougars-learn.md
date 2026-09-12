---
"blocky-ui": minor
---

Manage multiple Blocky servers from one dashboard, with combined statistics and query logs, and independent action targets.

#### Dashboard and actions

- Adds a picker to choose which servers contribute to the overview cards, history charts, Top Lists, and query logs.
- Enable, pause, or disable blocking across selected servers, and run cache clearing or list reloads against independent targets.
- Show combined statistics across selected servers, accounting for each server’s query volume.
- Run a DNS query against several servers and inspect separate, labelled result cards.
- Show when a server is unresponsive in a shared diagnostics panel.

![Multi-server dashboard and server selection](https://github.com/user-attachments/assets/805ab97c-0fe0-45c3-80fa-f4d6ac1a1036)

![DNS query results from multiple servers](https://github.com/user-attachments/assets/d14b6b66-349f-4326-a45e-7320cb3729e5)

#### Combined query history

With multiple query logging configured, query logs merge into one chronological, paginated list with server attribution, filtering, and auto-refresh. Charts, domain/client rankings, and filter suggestions use the same server selection configured on the top-level "View" select.

#### Query performance and reliability

We improved performance throughout various different areas. Query logs appear sooner when opening the table, searching domains, filtering clients, and navigating older pages. Top Lists page changes also reuse recent results.

Benchmarked through the MySQL provider with ~3 million real query-log entries per server. The three-server setup uses independent database copies, ~10 million entries combined:

| Operation                                      | Before, 1 server | After, 1 server | After, 3 servers | % Less time, 1 server |
| ---------------------------------------------- | ---------------: | --------------: | ---------------: | --------------------: |
| Load the first page of log rows                |          ~700 ms |           ~2 ms |          ~2.5 ms |                 99.7% |
| Load log rows after a domain search            |           ~2.5 s |          ~13 ms |           ~11 ms |                 99.5% |
| Load log rows filtered by client               |          ~850 ms |           ~7 ms |            ~7 ms |                 99.2% |
| Load log rows one million entries into history |             ~2 s |         ~130 ms |          ~146 ms |                   93% |
| Load Top Domains, 30 days                      |            ~13 s |          ~8.5 s |           ~8.8 s |                   37% |
| Load Top Clients, 30 days                      |             ~7 s |         ~2.93 s |           ~3.5 s |                   60% |

Median server-side times from five runs, using MariaDB with empty application caches and all databases on the same host. Results may vary by provider and dataset.

Also fixes inconsistent log timestamps and ordering, missing or misaligned chart data, CSV entries containing tabs or line breaks, and searches containing special characters in VictoriaLogs.

### Deprecation notice: environment-variable configuration

Due to the more complex nature of multiple servers configuration, YAML now replaces environment variables for configuring BlockyUI, for both single-server and multi-server setups. `BLOCKY_API_URL`, `BLOCKY_REQUEST_HEADERS`, `QUERY_LOG_*`, `INSTANCE_NAME` and `DEMO_MODE` are deprecated.

Existing environment-variable configurations still work in this release when no YAML file is configured, but support will be removed in a next major release.

Move your settings to a YAML file using [blocky-ui.example.yml](https://github.com/GabeDuarteM/blocky-ui/blob/main/blocky-ui.example.yml) as reference, then point the `BLOCKY_UI_CONFIG` environment variable to it:

```sh
BLOCKY_UI_CONFIG=/config/blocky-ui.yml
```
