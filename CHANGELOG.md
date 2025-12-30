# blocky-ui

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
