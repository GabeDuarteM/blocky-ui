# BlockyUI

BlockyUI is a modern companion dashboard for your [Blocky DNS](https://github.com/0xERR0R/blocky) server. It connects to an existing Blocky instance to display statistics, query DNS records, and much more.

![BlockyUI Screenshot](docs/BlockyUI-Screenshot.png)

## ✨ Key Features

- DNS blocking controls with optional timed disable presets
- DNS query tool to test domain blocking and filtering rules
- One-click cache clearing and list refresh
- Search through query logs and filter them (requires [query logging](https://0xerr0r.github.io/blocky/latest/configuration/#query-logging) configured on Blocky)
  - Supports MySQL, PostgreSQL (including Timescale), CSV, CSV-Client, and console (check `QUERY_LOG_CONSOLE_PROVIDER`) logging types from Blocky
  - CSV Query Logging is restricted to the most recent day's logs due to performance considerations
- Statistics sections
  - Overview cards: total queries, blocked requests, cache hit rate, listed domains, average response time (requires [statistics](https://0xerr0r.github.io/blocky/latest/configuration/#statistics) enabled on Blocky)
  - Top domains, blocked domains, and clients use Blocky's rolling 24-hour statistics when query logging is not configured
  - Queries over time and richer top lists with selectable ranges, filtering, and pagination require [query logging](https://0xerr0r.github.io/blocky/latest/configuration/#query-logging) configured on Blocky

## 🏁 Getting Started

### Prerequisites

- A running Blocky server reachable by BlockyUI

### Using Docker Compose

1. Create a `docker-compose.yml` file:

```yaml
services:
  blocky-ui:
    image: ghcr.io/gabeduartem/blocky-ui:latest # or for example `blocky-ui:1.5.0` if you prefer pinned versions
    container_name: blocky-ui
    restart: unless-stopped
    depends_on:
      - blocky

    ports:
      - 3000:3000

    environment:
      - BLOCKY_API_URL=http://blocky:4000
      # Uncomment to add custom headers to Blocky API requests (e.g. authentication)
      # - BLOCKY_REQUEST_HEADERS={"Authorization":"Bearer your-token-here"}

      # Uncomment to enable query logging features

      # from a MySQL/MariaDB database:
      # - QUERY_LOG_TYPE=mysql
      # - QUERY_LOG_TARGET=mysql://username:password@localhost:3306/blocky_query_log

      # from a PostgreSQL database:
      # - QUERY_LOG_TYPE=postgresql
      # - QUERY_LOG_TARGET=postgresql://username:password@localhost:5432/blocky_query_log

      # from a Postgres database with Timescale configured (in postgres AND blocky):
      # - QUERY_LOG_TYPE=timescale
      # - QUERY_LOG_TARGET=postgresql://username:password@localhost:5432/blocky_query_log

      # from a SQLite database file:
      # - QUERY_LOG_TYPE=sqlite
      # - QUERY_LOG_TARGET=/path/to/blocky/query-log.db

      # from a CSV file (single daily file):
      # - QUERY_LOG_TYPE=csv
      # - QUERY_LOG_TARGET=/path/to/blocky/logs/folder/

      # from CSV per-client files (multiple files per day):
      # - QUERY_LOG_TYPE=csv-client
      # - QUERY_LOG_TARGET=/path/to/blocky/logs/folder/

      # from VictoriaLogs (blocky queryLog.type: console, logs shipped to VictoriaLogs):
      # - QUERY_LOG_TYPE=console
      # - QUERY_LOG_CONSOLE_PROVIDER=victorialogs
      # - QUERY_LOG_TARGET=http://victoria-logs-host:9428

      # Uncomment to display an instance name in the browser tab title
      # Useful when running multiple BlockyUI instances
      # - INSTANCE_NAME=blocky-vm2

  blocky:
    image: spx01/blocky
    container_name: blocky
    hostname: blocky
    restart: unless-stopped
    volumes:
      - ./blocky/config.yml:/app/config.yml
      - /etc/localtime:/etc/localtime:ro
    ports:
      - 4000:4000
      - 53:53/udp
```

2. Start the container:

```bash
docker compose up -d
```

Visit `http://localhost:3000` to access BlockyUI.

### Using Docker Run

```bash
docker run -d \
  -p 3000:3000 \
  -e BLOCKY_API_URL=http://your-blocky-server:4000 \
  -e QUERY_LOG_TYPE=mysql \
  -e QUERY_LOG_TARGET="mysql://username:password@localhost:3306/blocky_query_log_table_name" \
  ghcr.io/gabeduartem/blocky-ui:latest
```

## ⚙️ Configuration

Configure BlockyUI with environment variables, or use a YAML file for multiple servers.

| Variable                     | Required    | Default                 | Description                                                                                                              |
| ---------------------------- | ----------- | ----------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| `BLOCKY_API_URL`             | No          | `http://localhost:4000` | Base URL of your Blocky API (usually `http://blocky-host:4000`).                                                         |
| `BLOCKY_REQUEST_HEADERS`     | No          | None                    | JSON object of custom headers for all Blocky API requests (e.g., `'{"Authorization":"Bearer token"}'`).                  |
| `QUERY_LOG_TYPE`             | No          | None                    | Enables query logging. Accepted values: `mysql`, `postgresql`, `timescale`, `sqlite`, `csv`, `csv-client`, or `console`. |
| `QUERY_LOG_CONSOLE_PROVIDER` | Conditional | None                    | Required when `QUERY_LOG_TYPE=console`. Selects the console log backend. Currently supports `victorialogs`.              |
| `QUERY_LOG_TARGET`           | No          | None                    | Connection string, SQLite file path, or log folder path for the same target as Blocky's `queryLog.target`.               |
| `INSTANCE_NAME`              | No          | None                    | Custom label shown in the browser tab title. Useful for identifying multiple instances.                                  |
| `DEMO_MODE`                  | No          | `false`                 | Enables a kiosk mode with mocked data and actions. Useful if you just want to see how it looks.                          |

### Multiple servers

Set `BLOCKY_UI_CONFIG=/config/blocky-ui.yml` to load a YAML file. Start with [blocky-ui.example.yml](blocky-ui.example.yml). Mount the file read-only when running in Docker:

```yaml
environment:
  BLOCKY_UI_CONFIG: /config/blocky-ui.yml
volumes:
  - ./blocky-ui.yml:/config/blocky-ui.yml:ro
  - ./office-logs:/logs/office:ro
```

Restart Blocky UI after changing the file. Server IDs such as `nas` identify saved selections, so keep them stable when changing a display name or URL. New servers start selected. View, blocking, maintenance, and DNS queries each have their own selection.

The YAML file replaces `BLOCKY_API_URL`, `BLOCKY_REQUEST_HEADERS`, and the `QUERY_LOG_*` settings. Without a file, existing environment configuration still works. Each server accepts an optional `headers` mapping for authenticated APIs. URLs, headers, and log credentials stay on the server.

Define each log store once under `logSources`. Servers sharing a store reference the same source ID and provide the hostname written by Blocky. Console sources use the `instance` field for this mapping. A source used by just one server can omit `hostname`, which treats the source as dedicated to that server. Unmapped records in shared sources remain visible as Unknown, including in charts and rankings.

Supported source types are `mysql`, `postgresql`, `timescale`, `sqlite`, `csv`, `csv-client`, and `console`. Console sources also require `consoleProvider: victorialogs`; their target is the VictoriaLogs base URL. Use paths accessible inside the container for file sources.

Live statistics come from each server's `/api/stats` endpoint. Configure direct instance URLs to avoid alternating between replicas behind a load balancer. These counters retain Blocky's time-window and restart limits; log history does not replace them. Cache entries count the entries stored across selected servers, including copies held by more than one server. Log history remains available when a Blocky API is offline. Counts and history aggregates are cached for 30 seconds after loading; expensive first loads still depend on the underlying store. Log rows can load before the total page count.

Blocking commands go to the selected API URLs. Blocky instances sharing Redis can propagate blocking changes to each other through Blocky's own synchronization. Selection does not isolate those instances. Blocky UI refreshes every configured server's blocking status after commands.

### Common Setups

- **Basic**: set only `BLOCKY_API_URL`. Server status, operations, and query tools will be visible.
- **Blocky with statistics enabled**: Add [statistics](https://0xerr0r.github.io/blocky/latest/configuration/#statistics) to Blocky's configuration to show the rolling 24-hour overview cards and top lists.
- **Query logging**: Enables query logs and the statistics charts with selectable time ranges, filtering, and pagination.

### Local Development

1. Clone the repository:

```bash
git clone https://github.com/gabeduartem/blocky-ui.git
cd blocky-ui
```

2. Install dependencies:

```bash
bun install
```

3. Configure environment variables:

```bash
cp .env.example .env
# Don't forget to update the file with the correct values
```

4. Start the development server:

```bash
bun dev
```

Visit `http://localhost:3000` to access BlockyUI.

### Test providers with real query logs

Use `bun run log-data --help` to export a read-only MySQL snapshot and copy it into disposable MySQL, PostgreSQL, Timescale, SQLite, CSV or VictoriaLogs stores. See the [data transfer guide](scripts/log-data/README.md) for setup, timezone handling and format differences.

## ⭐ Star History

[![Star History Chart](https://api.star-history.com/svg?repos=gabeduartem/blocky-ui&type=date&legend=top-left)](https://www.star-history.com/#gabeduartem/blocky-ui&type=date&legend=top-left)

## 🤝 Contributing

We welcome contributions! Whether it's bug fixes, new features, or documentation
improvements, your input helps make BlockyUI better. Check out our [Contributing Guide](CONTRIBUTING.md) to get started.
