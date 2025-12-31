# blocky-ui

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
