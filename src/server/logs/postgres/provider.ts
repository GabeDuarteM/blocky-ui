import { sql, type SQL } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import fs from "node:fs";

import { logEntries } from "~/server/logs/postgres/schema";
import { type TimeRange } from "~/lib/constants";
import { BaseSqlLogProvider } from "~/server/logs/sql/base-provider";

interface PostgreSQLOptions {
  connectionUri: string;
  // SSL is now optional because we derive it from the URI
  ssl?: {
    enabled: boolean;
    caPath?: string;
    certPath?: string;
    keyPath?: string;
  };
}

export class PostgreSQLLogProvider extends BaseSqlLogProvider {
  private readonly conn: ReturnType<typeof postgres>;

  constructor(options: PostgreSQLOptions) {
    console.log("[DB Debug] Initializing PostgreSQLLogProvider...");
    
    // 1. Parse the URI to extract parameters
    const url = new URL(options.connectionUri);
    const params = url.searchParams;

    // 2. Derive SSL settings
    const sslMode = params.get("sslmode") || "disable";
    const isSslEnabled = options.ssl?.enabled ?? (sslMode !== "disable");
    
    const caPath = options.ssl?.caPath ?? params.get("sslrootcert");
    const certPath = options.ssl?.certPath ?? params.get("sslcert");
    const keyPath = options.ssl?.keyPath ?? params.get("sslkey");

    console.log(`[DB Debug] URI Host: ${url.hostname}`);
    console.log(`[DB Debug] SSL Enabled: ${isSslEnabled} (Mode: ${sslMode})`);

    let sslConfig: any = null;

    if (isSslEnabled) {
      sslConfig = {};
      
      const loadCert = (label: string, path?: string | null) => {
        if (!path) return null;
        if (!fs.existsSync(path)) {
          console.error(`[DB Debug] ${label} file NOT FOUND at: ${path}`);
          return null;
        }
        const content = fs.readFileSync(path);
        console.log(`[DB Debug] ${label} loaded successfully (${content.length} bytes)`);
        return content;
      };

      sslConfig.ca = loadCert("Root CA", caPath);
      sslConfig.cert = loadCert("Client Cert", certPath);
      sslConfig.key = loadCert("Client Key", keyPath);
    }

    // 3. CLEAN THE URI
    // We must remove libpq-specific SSL params so the server doesn't reject the startup packet
    const cleanParams = new URLSearchParams(params);
    cleanParams.delete("sslmode");
    cleanParams.delete("sslcert");
    cleanParams.delete("sslkey");
    cleanParams.delete("sslrootcert");
    
    // Reconstruct the URI without the forbidden parameters
    const cleanedUri = `${url.protocol}//${url.username}:${url.password ? encodeURIComponent(url.password) : ''}@${url.hostname}:${url.port}${cleanParams.toString() ? '?' + cleanParams.toString() : ''}${url.pathname}`;

    console.log(cleanedUri);

    try {
      // Pass the CLEANED uri, not the original one
      const conn = postgres(cleanedUri, {
        ssl: sslConfig,
        connection: {
          timezone: "UTC",
        },
      });

      (async () => {
        try {
          console.log("[DB Debug] Attempting immediate connection test...");
          await conn`SELECT 1`; 
          console.log("[DB Debug] Connection test successful!");
        } catch (err: any) {
          console.error("[DB Debug] CONNECTION TEST FAILED:");
          console.error(`- Message: ${err.message}`);
          console.error(`- Code: ${err.code}`);
        }
      })();

      const db = drizzle(conn, { schema: { logEntries } });

      super({
        db,
        table: logEntries,
        columns: logEntries,
      });

      this.conn = conn;
    } catch (initError: any) {
      console.error("[DB Debug] Fatal error during driver initialization:", initError);
      throw initError;
    }
  }

  async close(): Promise<void> {
    await this.conn.end();
  }

  protected formatDateTimeForFilter(date: Date): string {
    return date.toISOString();
  }

  protected getBucketExpression(range: TimeRange): SQL {
    const col = logEntries.requestTs.name;

    switch (range) {
      case "1h":
        return sql.raw(
          `TO_CHAR(DATE_TRUNC('hour', ${col}) + INTERVAL '5 min' * FLOOR(EXTRACT(MINUTE FROM ${col}) / 5), 'YYYY-MM-DD HH24:MI')`,
        );
      case "24h":
        return sql.raw(
          `TO_CHAR(DATE_TRUNC('hour', ${col}), 'YYYY-MM-DD HH24:00')`,
        );
      case "7d":
        return sql.raw(
          `TO_CHAR(DATE_TRUNC('day', ${col}) + INTERVAL '6 hours' * FLOOR(EXTRACT(HOUR FROM ${col}) / 6), 'YYYY-MM-DD HH24:00')`,
        );
      case "30d":
        return sql.raw(`TO_CHAR(DATE_TRUNC('day', ${col}), 'YYYY-MM-DD')`);
    }
  }
}
