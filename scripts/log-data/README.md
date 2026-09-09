# Copy Blocky query logs between providers

This development tool exports MySQL/MariaDB query logs once, then imports that snapshot into separate test stores. It does not modify the source or create database tables. SQL destinations must be initialized by Blocky and empty, with their Blocky writer stopped during import.

```sh
# Set SOURCE_URL using your local secret configuration, preferably a read-only account.
bun run log-data export --source-env SOURCE_URL --out /tmp/blocky-snapshot
bun run log-data verify --snapshot /tmp/blocky-snapshot

# TARGET_URL points to an empty, disposable PostgreSQL database initialized by Blocky.
bun run log-data import --snapshot /tmp/blocky-snapshot --to postgresql --target-env TARGET_URL

bun run log-data import --snapshot /tmp/blocky-snapshot --to csv --out /tmp/blocky-csv
bun run log-data import --snapshot /tmp/blocky-snapshot --to csv-client --out /tmp/blocky-clients
bun run log-data import --snapshot /tmp/blocky-snapshot --to console --out /tmp/blocky-console
```

SQL destinations are `mysql`, `postgresql`, `timescale` and `sqlite`. For SQLite, the target environment variable contains an existing database file path. `victorialogs` accepts the HTTP base URL of an empty VictoriaLogs instance and ingests console events directly. `console` writes JSON lines that can instead go through your normal log collector.

## Initialize a destination

Create an empty database on your throwaway MySQL, PostgreSQL or Timescale instance. Start Blocky with a minimal configuration pointing `queryLog` at that database, wait for its HTTP API to become ready, then stop Blocky before importing. For example:

```yaml
ports:
  dns: 53
  http: 4000
upstreams:
  groups:
    default: [1.1.1.1]
queryLog:
  type: postgresql
  target: postgres://test:test@postgres:5432/blocky?sslmode=disable
  flushInterval: 1s
  logRetentionDays: 0
```

For MySQL, Blocky expects a Go DSN such as `test:test@tcp(mysql:3306)/blocky?charset=utf8mb4&parseTime=True&loc=UTC`. This tool expects a URL such as `mysql://test:test@localhost:3306/blocky`. For SQLite, use `type: sqlite` and a writable file path. Timescale needs the extension installed and `type: timescale`. Set a long positive `logRetentionDays`, such as `36500`, for a retained Timescale fixture. Blocky v0.34.0 installs a zero-day Timescale retention policy when this is `0`, even though `0` disables cleanup for the other providers. Use UTC for destination Blocky processes.

The integration test in `__tests__/transfer.test.ts` contains executable examples using disposable containers and native Blocky initialization.

## Reuse the data for scenarios

Exports stream in primary-key order under a read-only, repeatable-read MySQL transaction. Only InnoDB is supported. `--limit 10000` captures the first 10,000 retained records by ID for a small experiment. A large export keeps an old transaction snapshot alive until it finishes, so use a replica or a bounded export when production load matters.

MySQL DATETIME does not store a timezone. The default interpretation is UTC. Set `--offset +02:00` only when that fixed offset matches how your source wrote the entire selected dataset. A dataset spanning daylight-saving changes in local wall time cannot be unambiguously reconstructed using a single offset.

Imports preserve event timestamps by default. To move the dataset into a dashboard's current time window, add `--latest-at 2026-09-09T12:00:00.000Z`. This shifts every event by the same amount, preserving spacing. `--hostname blocky-two` changes the instance hostname. The command reports the shift and override. Import the same snapshot into multiple fresh stores to compare providers or instance counts without repeatedly reading production.

## Comparing the dashboard

A snapshot copies query-log history, not the Blocky deployment. The dashboard's overview cards use the live `/api/stats` endpoint. Fresh Blocky processes have fresh counters, cache contents and their own configured blocklists, regardless of the imported history.

Select one destination at a time to compare it with the source. Selecting several independent copies combines their events. Snapshots do not receive later source traffic. CSV imports contain all exported days, but the dashboard's CSV readers currently display only the latest day.

## What is preserved

The gzip JSON-lines snapshot preserves the 12 event fields, including nulls and duplicate events. Its manifest records row count, timestamp range and an order-independent SHA-256 multiset fingerprint. Source database IDs are omitted; each destination uses its native identity scheme.

SQL imports use bounded batches and a transaction, then read every inserted event back and compare count and fingerprint before committing. They do not add indexes or run migrations. Destination IDs and sequences may advance even when an import rolls back. Stop other writers while importing.

CSV and console cannot represent all database fields:

- Neither stores `effective_tldp`, database IDs or the distinction between null and empty strings.
- MySQL already normalized DNS names to lowercase without the final dot. File and console exports restore the dot, but cannot recover the original spelling.
- CSV uses Blocky's tab-separated CSV quoting and UTC daily filenames. Timestamps lose milliseconds. Per-client filenames reconstruct client lists by splitting the stored name on `; `.
- Console omits zero-valued fields, including a zero duration. It uses request time where the original console event would have used log emission time.

VictoriaLogs imports check the final indexed count, not a full content fingerprint. Configure sufficient retention or explicitly shift old data first. VictoriaLogs and file outputs have no rollback. Discard a partial test destination before retrying; the tool does not retry writes automatically.

Keep snapshots and imported data outside the repository. They contain real browsing history. New snapshot and file directories use owner-only permissions. A failed snapshot has no completion manifest and cannot pass verification.

The native format reference is [Blocky v0.34.0's querylog package](https://github.com/0xERR0R/blocky/tree/v0.34.0/querylog). Format compatibility is version-specific, so rerun the integration tests when updating Blocky.

```sh
bun run test scripts/log-data/__tests__/transfer.test.ts
```

To run the same SQL and VictoriaLogs import checks against a local snapshot, set `BLOCKY_TRANSFER_SNAPSHOT`:

```sh
BLOCKY_TRANSFER_SNAPSHOT=/path/to/snapshot bun run test scripts/log-data
```

This still creates disposable destination containers. It never reconnects to the snapshot's original database. The native-writer and malformed-data tests run alongside the supplied dataset.
