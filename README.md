# BlockyUI

BlockyUI is a modern companion dashboard for your [Blocky DNS](https://github.com/0xERR0R/blocky) server. It connects to an existing Blocky instance to display statistics, query DNS records, and much more.

![BlockyUI Screenshot](docs/BlockyUI-Screenshot.png)

## ✨ Key Features

- DNS blocking controls with optional timed disable presets
- DNS query tool to test domain blocking and filtering rules
- One-click cache clearing and list refresh
- Search through query logs and filter them (requires [query logging](https://0xerr0r.github.io/blocky/latest/configuration/#query-logging) configured on Blocky)
  - Supports MySQL, PostgreSQL (including Timescale), CSV, SQLite, CSV-Client, and console through VictoriaLogs logging types from Blocky
  - CSV Query Logging is restricted to the most recent day's logs due to performance considerations
- Statistics sections
  - Overview cards: total queries, blocked requests, cache hit rate, listed domains, average response time (requires [statistics](https://0xerr0r.github.io/blocky/latest/configuration/#statistics) enabled on Blocky)
  - Top domains, blocked domains, and clients use Blocky's rolling 24-hour statistics when query logging is not configured
  - Queries over time and richer top lists with selectable ranges, filtering, and pagination require [query logging](https://0xerr0r.github.io/blocky/latest/configuration/#query-logging) configured on Blocky

## 🏁 Getting Started

### Prerequisites

- A running Blocky server reachable by BlockyUI

See [blocky-ui.example.yml](blocky-ui.example.yml) for configuration options and examples.

### Using Docker Compose

Create a `docker-compose.yml` file alongside `blocky-ui.yml`:

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
      BLOCKY_UI_CONFIG: /config/blocky-ui.yml
    volumes:
      - ./blocky-ui.yml:/config/blocky-ui.yml

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

Then visit `http://localhost:3000` to access BlockyUI.

### Using Docker

```bash
docker run -d \
  -p 3000:3000 \
  -e BLOCKY_UI_CONFIG=/config/blocky-ui.yml \
  -v "$(pwd)/blocky-ui.yml:/config/blocky-ui.yml" \
  ghcr.io/gabeduartem/blocky-ui:latest
```

### Statistics and query logs

BlockyUI offers analytics for statistics and historical query logs, also allowing you to go through blocked queries and search specific ones. This is optional and will gracefully fallback if your blocky instance doesn't support it.

Enable [statistics](https://0xerr0r.github.io/blocky/latest/configuration/#statistics) in Blocky if you want the live overview and Top Lists, and [query logging](https://0xerr0r.github.io/blocky/latest/configuration/#query-logging) in Blocky and connect its log source in [blocky-ui.yml](blocky-ui.example.yml) if you want the query-log table or history charts with selectable time ranges

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

3. Copy the configuration files and edit `blocky-ui.yml` for your setup:

```bash
cp blocky-ui.example.yml blocky-ui.yml
cp .env.example .env
```

4. Start the development server:

```bash
bun dev
```

Visit `http://localhost:3000` to access BlockyUI.

#### Test providers with real query logs

Use `bun run log-data --help` to export a read-only MySQL snapshot and copy it into disposable MySQL, PostgreSQL, Timescale, SQLite, CSV or VictoriaLogs stores. See the [data transfer guide](scripts/log-data/README.md) for setup, timezone handling and format differences.

## ⭐ Star History

[![Star History Chart](https://api.star-history.com/svg?repos=gabeduartem/blocky-ui&type=date&legend=top-left)](https://www.star-history.com/#gabeduartem/blocky-ui&type=date&legend=top-left)

## 🤝 Contributing

We welcome contributions! Whether it's bug fixes, new features, or documentation
improvements, your input helps make BlockyUI better. Check out our [Contributing Guide](CONTRIBUTING.md) to get started.
