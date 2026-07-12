import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

export const env = createEnv({
  /**
   * Specify your server-side environment variables schema here. This way you can ensure the app
   * isn't built with invalid env vars.
   */
  server: {
    QUERY_LOG_TYPE: z
      .enum([
        "mysql",
        "postgresql",
        "timescale",
        "sqlite",
        "csv",
        "csv-client",
        "console",
      ])
      .optional(),
    QUERY_LOG_CONSOLE_PROVIDER: z.enum(["victorialogs"]).optional(),
    QUERY_LOG_TARGET: z.string().optional(),
    NODE_ENV: z.enum(["development", "test", "production"]),
    BLOCKY_API_URL: z.url().default("http://localhost:4000"),
    BLOCKY_REQUEST_HEADERS: z
      .string()
      .transform((val) => JSON.parse(val))
      .optional(),
    PROMETHEUS_PATH: z.string().startsWith("/").default("/metrics"),
    DEMO_MODE: z.boolean().default(false),
    INSTANCE_NAME: z.string().optional(),
  },

  /**
   * Specify your client-side environment variables schema here. This way you can ensure the app
   * isn't built with invalid env vars. To expose them to the client, prefix them with
   * `NEXT_PUBLIC_`.
   */
  client: {
    // NEXT_PUBLIC_CLIENTVAR: z.string(),
  },

  /**
   * You can't destruct `process.env` as a regular object in the Next.js edge runtimes (e.g.
   * middlewares) or client-side so we need to destruct manually.
   */
  runtimeEnv: {
    QUERY_LOG_TYPE: process.env.QUERY_LOG_TYPE,
    QUERY_LOG_CONSOLE_PROVIDER: process.env.QUERY_LOG_CONSOLE_PROVIDER,
    QUERY_LOG_TARGET: process.env.QUERY_LOG_TARGET,
    NODE_ENV: process.env.NODE_ENV,
    BLOCKY_API_URL: process.env.BLOCKY_API_URL,
    BLOCKY_REQUEST_HEADERS: process.env.BLOCKY_REQUEST_HEADERS,
    PROMETHEUS_PATH: process.env.PROMETHEUS_PATH,
    DEMO_MODE: process.env.DEMO_MODE === "true",
    INSTANCE_NAME: process.env.INSTANCE_NAME,
    // NEXT_PUBLIC_CLIENTVAR: process.env.NEXT_PUBLIC_CLIENTVAR,
  },

  /**
   * Run `build` or `dev` with `SKIP_ENV_VALIDATION` to skip env validation. This is especially
   * useful for Docker builds.
   */
  skipValidation: !!process.env.SKIP_ENV_VALIDATION,
  /**
   * Makes it so that empty strings are treated as undefined. `SOME_VAR: z.string()` and
   * `SOME_VAR=''` will throw an error.
   */
  emptyStringAsUndefined: true,
});
