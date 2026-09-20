FROM mcr.microsoft.com/playwright:v1.63.0-noble

RUN apt-get update \
    && apt-get install -y --no-install-recommends g++ make python3 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY package.json bun.lock ./
RUN npm install --global "$(node -p 'require("./package.json").packageManager')" \
    && bun install --frozen-lockfile
COPY . .
RUN bun run build

ENTRYPOINT ["bun", "x", "playwright", "test"]
