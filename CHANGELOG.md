# blocky-ui

## 2.0.0

### Major Changes

- [#390](https://github.com/GabeDuarteM/blocky-ui/pull/390) [`4c38f85`](https://github.com/GabeDuarteM/blocky-ui/commit/4c38f8502bb74fdf34f6b57446626b1aba7b29c7) Thanks [@GabeDuarteM](https://github.com/GabeDuarteM)! - Replace Prometheus-backed overview statistics with Blocky's statistics API, add rolling 24-hour top lists for installations without query logging, and remove deprecated configuration.

  #### Blocky statistics

  BlockyUI now reads various statistics from Blocky's `/api/stats` endpoint, instead of requiring a prometheus integration and reading from it. Query logging remains optional and continues to provide longer time ranges, filtering, pagination, and detailed query logs when configured.

  Without query logging, the statistics API provides rolling 24-hour Top Domains with All and Blocked views, plus Top Clients.

  Overview total queries, outcomes, cache hit rate, and average response time now use Blocky's rolling 24-hour statistics.

  ![Statistics overview](https://i.imgur.com/SYJvGfe.png)

  #### Breaking changes

  ##### Statistics configuration

  BlockyUI no longer queries Prometheus for dashboard statistics, and the `PROMETHEUS_PATH` environment variable has been removed. Installations that only expose Prometheus metrics, run a Blocky version older than v0.33.0, or do not enable Blocky's statistics API will no longer display the Overview cards or fallback Top Lists.

  To migrate, upgrade to Blocky v0.33.0 or newer and enable statistics:

  ```yaml
  statistics:
    enable: true
  ```

  ##### Query log configuration

  `DATABASE_URL` has been deprecated since v1.2.0 and is now no longer accepted. Configure the query log provider explicitly:

  ```env
  QUERY_LOG_TYPE=mysql
  QUERY_LOG_TARGET=mysql://username:password@localhost:3306/blocky_query_log
  ```

### Minor Changes

- [#390](https://github.com/GabeDuarteM/blocky-ui/pull/390) [`4c38f85`](https://github.com/GabeDuarteM/blocky-ui/commit/4c38f8502bb74fdf34f6b57446626b1aba7b29c7) Thanks [@GabeDuarteM](https://github.com/GabeDuarteM)! - Improved dashboard usability with independent Top Lists timeframes, redesigned Query Tool results, and selectable log domains.

  #### Query Tool results

  Query Tool results got a complete redesign and now separates the query outcome from the returned DNS answers in a clearer layout.

  ![Blocked Query Tool results](https://i.imgur.com/pQgqE33.png)

  ![Cached Query Tool results](https://i.imgur.com/YkXbmHC.png)

  #### Top Lists controls

  Previously, the Top Lists used to share the time-frame options with the Queries over time chart, which could be confusing in some cases. Now they have their own time-frame selector on the top right, so they can be explored completely independently.

  ![Top Lists controls](https://i.imgur.com/FH2eSYp.png)

  #### Query log usability

  Domains in the query log can now be selected like normal text. Full-domain tooltips only appear when the displayed value is truncated. Also, on the page switcher large page counts now use grouped digits for easier reading.

### Patch Changes

- [#383](https://github.com/GabeDuarteM/blocky-ui/pull/383) [`194e8c7`](https://github.com/GabeDuarteM/blocky-ui/commit/194e8c7761fdd3eb0a5957b5910fa58eee8c0454) Thanks [@GabeDuarteM](https://github.com/GabeDuarteM)! - Clarify the Blocking Status card to show that its controls enable or disable query blocking without stopping the DNS server. Fixes [#353](https://github.com/GabeDuarteM/blocky-ui/issues/353)

- [#390](https://github.com/GabeDuarteM/blocky-ui/pull/390) [`4c38f85`](https://github.com/GabeDuarteM/blocky-ui/commit/4c38f8502bb74fdf34f6b57446626b1aba7b29c7) Thanks [@GabeDuarteM](https://github.com/GabeDuarteM)! - Fixes the seven-day Queries over time hover points so they properly follow the active time bucket on mouse movements.

## 1.9.1

### Patch Changes

- [#350](https://github.com/GabeDuarteM/blocky-ui/pull/350) [`ab567c0`](https://github.com/GabeDuarteM/blocky-ui/commit/ab567c0af99b787bfe5bb59a5ee777b99c497d54) Thanks [@GabeDuarteM](https://github.com/GabeDuarteM)! - Fix SQLite query log support in armv6 and armv7 Docker images.

  The Docker build now compiles the `better-sqlite3` native addon for each target runtime platform before copying it into the final image, so SQLite query logs work on 32-bit ARM images.

- [#347](https://github.com/GabeDuarteM/blocky-ui/pull/347) [`7f567dd`](https://github.com/GabeDuarteM/blocky-ui/commit/7f567dd9669db4d091aaeb170b58137876f2ffa6) Thanks [@GabeDuarteM](https://github.com/GabeDuarteM)! - Fix SQLite query log support in Docker images. Fixes [#342](https://github.com/GabeDuarteM/blocky-ui/issues/342)

  The Docker build now installs dependencies in a Node-based builder so the `better-sqlite3` native module matches the Node runtime used by the production image.

## 1.9.0

### Minor Changes

- [#327](https://github.com/GabeDuarteM/blocky-ui/pull/327) [`560baa3`](https://github.com/GabeDuarteM/blocky-ui/commit/560baa3f955718b633ec3482d2a6a40cc5ff9b6a) Thanks [@GabeDuarteM](https://github.com/GabeDuarteM)! - Add full support for Blocky's new SQLite query log target.

  #### Configuration

  Set `QUERY_LOG_TYPE` to `sqlite` and `QUERY_LOG_TARGET` to the SQLite database file path used by Blocky's `queryLog.target`:

  ```env
  QUERY_LOG_TYPE=sqlite
  QUERY_LOG_TARGET=/path/to/blocky/query-log.db
  ```

## 1.8.1

### Patch Changes

- [#300](https://github.com/GabeDuarteM/blocky-ui/pull/300) [`2f2dbc7`](https://github.com/GabeDuarteM/blocky-ui/commit/2f2dbc7242563ca1162e69758ea9fe8d5e07f4d0) Thanks [@GabeDuarteM](https://github.com/GabeDuarteM)! - Improve dashboard layout on narrow screens.

  Dashboard controls now stack more cleanly on mobile, giving the queries-over-time controls, top list filters, and query log filters enough room on narrow screens.

## 1.8.0

### Minor Changes

- [#277](https://github.com/GabeDuarteM/blocky-ui/pull/277) [`b3db3c2`](https://github.com/GabeDuarteM/blocky-ui/commit/b3db3c271d8daa4dad43c7345db8bb341fc9d684) Thanks [@bellorr](https://github.com/bellorr)! - Add VictoriaLogs query log support

  #### Configuration

  Set `QUERY_LOG_TYPE` to `console`, `QUERY_LOG_CONSOLE_PROVIDER` to `victorialogs`, and `QUERY_LOG_TARGET` to a VictoriaLogs base URL:

  ```env
  QUERY_LOG_TYPE=console
  QUERY_LOG_CONSOLE_PROVIDER=victorialogs
  QUERY_LOG_TARGET=http://victoria-logs-host:9428
  ```

### Patch Changes

- [#293](https://github.com/GabeDuarteM/blocky-ui/pull/293) [`6dcb276`](https://github.com/GabeDuarteM/blocky-ui/commit/6dcb276f91460ce64afdddc3f58eb506295bb2bf) Thanks [@GabeDuarteM](https://github.com/GabeDuarteM)! - Keep dashboard data visible during background refreshes.

  Automatic query refreshes no longer replace query logs, top lists, or the queries-over-time chart with full loading states. Loading placeholders are now reserved for initial loads and uncached page or filter changes, and the queries-over-time chart uses an improved chart-shaped loading state.

  ![Queries over time loading state](https://i.imgur.com/hzrRhvI.png)

## 1.7.0

### Minor Changes

- [#272](https://github.com/GabeDuarteM/blocky-ui/pull/272) [`2786fc8`](https://github.com/GabeDuarteM/blocky-ui/commit/2786fc837c004a1a969212662873b57a481cba1e) Thanks [@mlhynfield](https://github.com/mlhynfield)! - Add optional BLOCKY_REQUEST_HEADERS environment variable supporting multiple custom request headers as a JSON object

### Patch Changes

- [#285](https://github.com/GabeDuarteM/blocky-ui/pull/285) [`2094933`](https://github.com/GabeDuarteM/blocky-ui/commit/2094933c1b4ec02df2548a580572092eac4b4ba3) Thanks [@GabeDuarteM](https://github.com/GabeDuarteM)! - Dramatically improve MySQL-backed dashboard performance on large query log tables

  Statistics queries that could take tens of seconds now complete in sub-second time in typical cases. This makes the initial dashboard load, top domains, top clients, queries-over-time, and adjacent page prefetches much faster when using `QUERY_LOG_TYPE=mysql`.

  #### Before and After

  Measured locally against a large MySQL query log table:

  | Query                       | Before |  After |
  | --------------------------- | -----: | -----: |
  | Top Clients                 |   ~60s | ~500ms |
  | Top Domains                 |   ~20s | ~650ms |
  | Queries Over Time           |    ~6s | ~400ms |
  | Overview                    |    ~5s | ~500ms |
  | Initial dashboard data load |   ~70s |    ~1s |

## 1.6.1

### Patch Changes

- [#260](https://github.com/GabeDuarteM/blocky-ui/pull/260) [`7ad8467`](https://github.com/GabeDuarteM/blocky-ui/commit/7ad846766fc56567eed2aa9ce907fa4274b58375) Thanks [@GabeDuarteM](https://github.com/GabeDuarteM)! - Fix layout overflow on mobile when domain or client names are long

  Long domain names in the Top Domains and Top Clients lists no longer push the layout wider than the screen on mobile devices. Names are now properly truncated with an ellipsis.

## 1.6.0

### Minor Changes

- [#242](https://github.com/GabeDuarteM/blocky-ui/pull/242) [`d2b3960`](https://github.com/GabeDuarteM/blocky-ui/commit/d2b39600f7adeef0ea3e902764b62b74b2d0e67a) Thanks [@aclerici38](https://github.com/aclerici38)! - Add PostgreSQL and TimescaleDB query log support

  #### Configuration

  Set `QUERY_LOG_TYPE` to `postgresql` or `timescale` and `QUERY_LOG_TARGET` to a PostgreSQL connection URI:

  ```env
  QUERY_LOG_TYPE=postgresql
  QUERY_LOG_TARGET=postgresql://username:password@localhost:5432/blocky_query_log
  ```

## 1.5.0

### Minor Changes

- [#211](https://github.com/GabeDuarteM/blocky-ui/pull/211) [`86d08e4`](https://github.com/GabeDuarteM/blocky-ui/commit/86d08e4f4470ab2cd1765397eea84bee70e76b46) Thanks [@GabeDuarteM](https://github.com/GabeDuarteM)! - Improve query logs with new filters, auto-refresh, and better duration display

  #### New Filters and Auto-Refresh

  You can now filter query logs by DNS record type (A, AAAA, CNAME, MX, etc.) and by all Blocky response types. A new auto-refresh toggle lets you enable or disable automatic refresh every 30 seconds.

  ![Query logs filters and auto-refresh toggle](https://i.imgur.com/dh4cUQR.png)

  #### Duration Column

  The Duration column now better indicates when no external DNS lookup was needed:
  - **Dash (—)**: Locally-resolved responses with 0ms duration (cached, blocked, hosts file, etc.)
  - **0ms**: Externally-resolved responses that returned instantly (e.g., due to upstream caching)
  - **Xms**: Normal duration for any response that took measurable time

  ![Duration column showing dash for cached entries](https://i.imgur.com/ILTIDb6.png)

- [#211](https://github.com/GabeDuarteM/blocky-ui/pull/211) [`86d08e4`](https://github.com/GabeDuarteM/blocky-ui/commit/86d08e4f4470ab2cd1765397eea84bee70e76b46) Thanks [@GabeDuarteM](https://github.com/GabeDuarteM)! - Add optional instance name in browser tab title

  #### Custom instance name

  When running multiple BlockyUI instances, you can now set an `INSTANCE_NAME` environment variable to display a custom name in the browser tab title (e.g., "BlockyUI @ blocky-vm2").

  To enable, add the environment variable to your configuration:

  ```sh
  INSTANCE_NAME=blocky-vm2
  ```

### Patch Changes

- [#211](https://github.com/GabeDuarteM/blocky-ui/pull/211) [`86d08e4`](https://github.com/GabeDuarteM/blocky-ui/commit/86d08e4f4470ab2cd1765397eea84bee70e76b46) Thanks [@GabeDuarteM](https://github.com/GabeDuarteM)! - Fix CSV log provider errors not showing in the UI

  CSV log provider errors (such as permission issues or missing directories) now display in the UI instead of failing silently with an empty table.

## 1.4.0

### Minor Changes

- aa37165: Add client filtering for query logs and support for CSV per-client log format

  #### Filter Query Logs by Client

  You can now filter query logs by client name in addition to domain. The search box shows suggestions for both domains and clients with their query counts.

  ![Filter by domain or client](https://i.imgur.com/pArfERS.png)

  #### CSV Per-Client Log Format Support

  Added support for Blocky's `csv-client` logging format, which stores logs in separate files per client.

  To enable, set in your environment:

  ```bash
  QUERY_LOG_TYPE=csv-client
  QUERY_LOG_TARGET=/path/to/blocky/logs/folder/
  ```

### Patch Changes

- e4b8349: Docker images are now published to **GitHub Container Registry** (GHCR)

  #### New Registry

  Blocky UI Docker images are now available on GitHub Container Registry at `ghcr.io/gabeduartem/blocky-ui`.

  Update your `docker-compose.yml` to use the new registry:

  ```yaml
  services:
    blocky-ui:
      image: ghcr.io/gabeduartem/blocky-ui:latest
  ```

  Or if using `docker run`:

  ```bash
  docker run -d ghcr.io/gabeduartem/blocky-ui:latest
  ```

  #### Docker Hub Deprecation Notice

  The existing Docker Hub image (`gabrielduartem/blocky-ui`) will continue to receive updates for the time being, but **may be discontinued in the future**. We recommend updating your configuration to use the GHCR image to avoid disruption.

## 1.3.0

### Minor Changes

- d0fe909: **Statistics Section**

  A new statistics section providing insights into your DNS queries and blocking activity.

  #### Features
  - **Overview Cards** - Total queries, blocked requests, cache hit rate, and listed domains

  _Requires [Prometheus](https://0xerr0r.github.io/blocky/latest/configuration/#prometheus) configured on Blocky_

  ![Overview Cards](https://i.imgur.com/Sf2T5Kl.png)
  - **Queries Over Time Chart** - Interactive chart with selectable time ranges (1h, 24h, 7d, 30d)
  - **Top Domains Table** - Most queried domains with filter for blocked only
  - **Top Clients Table** - Devices with the most DNS queries

  _Requires [query logging](https://0xerr0r.github.io/blocky/latest/configuration/#query-logging) (MySQL or CSV)_

  ![Statistics Dashboard](https://i.imgur.com/NtAdFhc.png)

  ### Configuration

  Metrics are fetched from `$BLOCKY_API_URL/metrics` by default.

  ```yaml
  environment:
    - PROMETHEUS_PATH=/custom-path # Optional, defaults to /metrics
    - QUERY_LOG_TYPE=mysql # or csv
    - QUERY_LOG_TARGET=mysql://user:pass@host:3306/database
  ```

## 1.2.0

### Minor Changes

- 218624b: feat: Add support for Query Logs of type "CSV"

  ### DEPRECATION NOTICE

  To better align with the configuration schema from blocky, the `DATABASE_URL` environment variable is now deprecated and replaced by `QUERY_LOG_TYPE` and `QUERY_LOG_TARGET`.
  While `DATABASE_URL` still works in this version, it will be removed in a future release.

  Replace it with:

  ```sh
  QUERY_LOG_TYPE=mysql
  QUERY_LOG_TARGET=mysql://your-database
  ```

### Patch Changes

- 190dd16: Update dependencies

## 1.1.6

### Patch Changes

- 1b3fd87: Fix React Server Components CVE

## 1.1.5

### Patch Changes

- ca002bc: Bump packages to cover CVEs

## 1.1.4

### Patch Changes

- 179e82f: fix a bug where some results were not shown on query logs

## 1.1.3

### Patch Changes

- c4763fe: Improve docs and validation for the DATABASE_URL env variable

## 1.1.2

### Patch Changes

- a4927a3: Remove unecessary url validation on the database env variable

## 1.1.1

### Patch Changes

- ca4d28f: Fix a bug where the docker builds would never show the new query logs table, even when configured to be shown

## 1.1.0

### Minor Changes

- bd05417: Add a Query Log search/filter when you have it [configured on blocky](https://0xerr0r.github.io/blocky/latest/configuration/#query-logging) and have the DATABASE_URL ENV variable filled (check the README for full instructions)

## 1.0.4

### Patch Changes

- 703b0ef: fix(deps): bump dependencies

## 1.0.3

### Patch Changes

- cc2fe44: chore: Automate docker image releases
