---
"blocky-ui": patch
---

Update dependencies

Includes security fixes in Next.js.

## Upgrade notes

### PostgreSQL and Timescale read `PGSSLMODE`

BlockyUI now reads the `PGSSLMODE` environment variable when it connects to PostgreSQL or Timescale. It was ignored before, so check it if it is set in the BlockyUI container:

- `require` fails if your database does not have TLS enabled. Enable TLS on the database, or remove `PGSSLMODE`.
- `verify-ca` and `verify-full` check the database certificate against the Node.js default trust store, and don't read `PGSSLROOTCERT` or `~/.postgresql/root.crt`. If your database uses a private certificate authority, add `sslrootcert=/path/to/ca.pem` to the connection URL, or set `ssl.ca: file:/path/to/ca.pem` under `logSources.<id>.target.options` when the target is written as an object.

An `ssl` option or an `sslmode` in the connection URL still takes priority over `PGSSLMODE`.
