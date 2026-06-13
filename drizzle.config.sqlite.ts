import { type Config } from "drizzle-kit";

import { env } from "./src/env.js";

export default {
  schema: "./src/server/logs/sqlite/schema.ts",
  dialect: "sqlite",
  dbCredentials: {
    url: env.QUERY_LOG_TARGET ?? "",
  },
} satisfies Config;
