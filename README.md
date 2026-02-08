# BlockyUI

BlockyUI is a modern companion dashboard for your [Blocky DNS](https://github.com/0xERR0R/blocky) server. It connects to an existing Blocky instance to display statistics, query DNS records, and much more.

![BlockyUI Screenshot](docs/BlockyUI-Screenshot.png)

## ✨ Key Features

- DNS blocking controls with optional timed disable presets
- DNS query tool to test domain blocking and filtering rules
- One-click cache clearing and list refresh
- Search through query logs and filter them (requires [query logging](https://0xerr0r.github.io/blocky/latest/configuration/#query-logging) configured on Blocky)
  - Supports MySQL, CSV and CSV-Client logging types from Blocky
  - CSV Query Logging is restricted to the most recent day's logs due to performance considerations
- Statistics sections
  - Overview cards: total queries, blocked requests, cache hit rate, listed domains (requires [Prometheus](https://0xerr0r.github.io/blocky/latest/configuration/#prometheus) enabled on Blocky)
  - Queries over time chart, top domains, and top clients (requires [query logging](https://0xerr0r.github.io/blocky/latest/configuration/#query-logging) configured on Blocky)

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
      # Uncomment to override the Prometheus metrics path (defaults to /metrics)
      # Only use this if you've changed `prometheus.path` on your Blocky's server config
      # - PROMETHEUS_PATH=/custom-metrics-path

      # Uncomment to enable query logging features

      # from a MySQL/MariaDB database:
      # - QUERY_LOG_TYPE=mysql
      # - QUERY_LOG_TARGET=mysql://username:password@localhost:3306/blocky_query_log_table_name

      # from a CSV file (single daily file):
      # - QUERY_LOG_TYPE=csv
      # - QUERY_LOG_TARGET=/path/to/blocky/logs/folder/

      # from CSV per-client files (multiple files per day):
      # - QUERY_LOG_TYPE=csv-client
      # - QUERY_LOG_TARGET=/path/to/blocky/logs/folder/

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

BlockyUI is configured via environment variables in all deployment methods.

| Variable           | Required | Default                 | Description                                                                                     |
| ------------------ | -------- | ----------------------- | ----------------------------------------------------------------------------------------------- |
| `BLOCKY_API_URL`   | No       | `http://localhost:4000` | Base URL of your Blocky API (usually `http://blocky-host:4000`).                                |
| `QUERY_LOG_TYPE`   | No       | None                    | Enable query logging. Can be `mysql`, `csv`, or `csv-client`.                                   |
| `QUERY_LOG_TARGET` | No       | None                    | Connection string or log folder path for query logs. Same as Blocky's `queryLog.target`.        |
| `INSTANCE_NAME`    | No       | None                    | Custom label shown in the browser tab title. Useful for identifying multiple instances.         |
| `PROMETHEUS_PATH`  | No       | `/metrics`              | Override if you have Prometheus enabled on Blocky and changed `prometheus.path`.                |
| `DEMO_MODE`        | No       | `false`                 | Enables a kiosk mode with mocked data and actions. Useful if you just want to see how it looks. |

### Common Setups

- **Basic**: set only `BLOCKY_API_URL`. Only the server status, operations, and query tools will be visible.
- **Blocky with Prometheus enabled**: Enables the statistics section.
- **Query logging**: Enables the sections for query logging, top lists, queries over time, and a more detailed total queries/blocked panels, scoped by the last 24 hours.

### Local Development

1. Clone the repository:

```bash
git clone https://github.com/gabeduartem/blocky-ui.git
cd blocky-ui
```

2. Install dependencies:

```bash
pnpm install
```

3. Configure environment variables:

```bash
cp .env.example .env
# Don't forget to update the file with the correct values
```

4. Start the development server:

```bash
pnpm dev
```

Visit `http://localhost:3000` to access BlockyUI.

## Star History

[![Star History Chart](https://api.star-history.com/svg?repos=gabeduartem/blocky-ui&type=date&legend=top-left)](https://www.star-history.com/#gabeduartem/blocky-ui&type=date&legend=top-left)

## 🤝 Contributing

We welcome contributions! Whether it's bug fixes, new features, or documentation
improvements, your input helps make BlockyUI better.
