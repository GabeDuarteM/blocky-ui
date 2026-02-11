# blocky-ui

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
