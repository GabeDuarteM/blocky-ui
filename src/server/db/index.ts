import { drizzle } from "drizzle-orm/mysql2";
import { createPool, type Pool } from "mysql2/promise";

import { env } from "~/env";
import * as schema from "./schema";

/**
 * Cache the database connection in development. This avoids creating a new connection on every HMR
 * update.
 */
const globalForDb = globalThis as unknown as {
  conn: Pool | undefined;
};

// Only create database connection if using MySQL log type
const createDbConnection = () => {
  if (env.QUERY_LOG_TYPE !== "mysql") {
    return undefined;
  }

  if (!env.QUERY_LOG_TARGET) {
    throw new Error(
      "QUERY_LOG_TARGET (MySQL connection URI) is required when QUERY_LOG_TYPE is 'mysql'",
    );
  }

  const conn = globalForDb.conn ?? createPool({ uri: env.QUERY_LOG_TARGET });
  if (env.NODE_ENV !== "production") globalForDb.conn = conn;

  return drizzle(conn, { schema, mode: "default" });
};

export const db = createDbConnection();
