# BlockyUI

A modern web interface for managing and controlling your [Blocky DNS](https://github.com/0xERR0R/blocky) server.

![BlockyUI Screenshot](docs/BlockyUI-Screenshot.png)

## ✨ Key Features

- DNS blocking controls with optional timed disable presets
- DNS query tool to test domain blocking and filtering rules
- One-click cache clearing and list refresh
- Search through query logs and filter them (requires [query logging](https://0xerr0r.github.io/blocky/latest/configuration/#query-logging) configured on blocky)
  - Requires MySQL/MariaDB or CSV logging type configured on Blocky

## 🏁 Getting Started

### Using Docker Compose

1. Create a `docker-compose.yml` file:

```yaml
services:
  blocky:
    image: spx01/blocky
    container_name: blocky
    hostname: blocky
    restart: unless-stopped
    volumes:
      - /etc/localtime:/etc/localtime:ro
    ports:
      - 4000:4000
      - 53:53/udp
  blocky-ui:
    image: gabrielduartem/blocky-ui:latest
    container_name: blocky-ui
    restart: unless-stopped
    depends_on:
      - blocky
    ports:
      - 3000:3000
    environment:
      - BLOCKY_API_URL=http://blocky:4000
      # Uncomment to enable query logging features
      # from a MySQL/MariaDB database:
      # - QUERY_LOG_TYPE=mysql
      # - QUERY_LOG_TARGET=mysql://username:password@localhost:3306/blocky_query_log_table_name
      # from a CSV file:
      # - QUERY_LOG_TYPE=csv
      # - QUERY_LOG_TARGET=/path/to/blocky/logs/
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
  gabrielduartem/blocky-ui:latest
```

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

## 🤝 Contributing

We welcome contributions! Whether it's bug fixes, new features, or documentation
improvements, your input helps make BlockyUI better.
