import { type Config } from "drizzle-kit";

import { env } from "./src/env.js";

export default {
  schema: "./src/server/logs/mysql/schema.ts",
  dialect: "mysql",
  dbCredentials: {
    url: env.QUERY_LOG_TARGET ?? "",
  },
} satisfies Config;