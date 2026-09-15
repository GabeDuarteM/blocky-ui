---
"blocky-ui": minor
---

Database password files

## Highlights

MySQL, PostgreSQL, and Timescale log sources now accept separate host, port, username, password, and database fields. Use `password: file:/run/secrets/db_password` to read a plain password from a secret file, and `options` for native driver settings. Existing connection URLs still work.
