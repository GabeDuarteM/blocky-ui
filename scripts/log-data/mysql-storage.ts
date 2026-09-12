import { TransferError } from "./errors";
import { type Connection } from "mysql2/promise";
import { z } from "zod";

export async function requireTransactionalTable(connection: Connection) {
  const [rows] = await connection.query(
    "SELECT ENGINE FROM information_schema.tables WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'log_entries'",
  );
  const engines = z
    .array(z.object({ ENGINE: z.string().nullable() }))
    .parse(rows);

  if (engines.length !== 1 || engines[0]?.ENGINE?.toLowerCase() !== "innodb") {
    throw new TransferError("The log_entries table must exist and use InnoDB.");
  }
}
