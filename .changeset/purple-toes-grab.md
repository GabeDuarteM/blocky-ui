---
"blocky-ui": minor
---

Separate database settings and file references

## Highlights

MySQL, PostgreSQL, and Timescale log sources now accept connection settings as an object. You can keep credentials separate from the connection URL and load credentials and TLS certificates from mounted files. Existing connection URLs still work.

### URL or structured configuration

For example, this MySQL URL includes two driver options in its query string:

```yaml
logSources:
  home:
    type: mysql
    target: mysql://blocky:change-me@mariadb:3306/blocky?connectionLimit=5&connectTimeout=30000
```

The same connection can now be written as:

```yaml
logSources:
  home:
    type: mysql
    target:
      host: mariadb
      port: 3306
      username: blocky
      password: change-me
      database: blocky
      options:
        connectionLimit: 5
        connectTimeout: 30000
```

`options` passes settings directly to the database driver, using its native option names and value types. Explicit connection fields take priority over options. Port and options are optional.

### Read the password from a secret file

Combined with the settings above, you can now also read the password from a file by configuring it with:

```yaml
password: file:/run/secrets/db_password
```

The file should contain only the password. Mount it into the BlockyUI container at that path. This lets you reuse the same password file wherever it's needed, including your database.

Whether you write the password in the structured configuration or read it from a file, characters such as `@` and `#` do not need URL encoding.

### File references in connection settings

Use `file:` or `file://` to read a complete target, host, username, password, database, or strings inside driver options from files, including strings in arrays.

For example, inside a database target:

```yaml
options:
  ssl:
    ca: file:/run/secrets/db_ca.pem
    cert: file:/run/secrets/db_cert.pem
    key: file:/run/secrets/db_key.pem
```

Use `!raw` when a string should reach the database driver unchanged, such as a SQLite file URI:

```yaml
logSources:
  home:
    type: sqlite
    target: !raw "file:/logs/blocky.db?mode=ro"
```
