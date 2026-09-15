---
"blocky-ui": minor
---

Structured database connections and password files

## Highlights

MySQL, PostgreSQL, and Timescale log sources now accept connection settings as an object. You can keep credentials separate from the connection URL and read the password from a secret file. Existing connection URLs still work.

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

Replace the password field with:

```yaml
password: file:/run/secrets/db_password
```

The file contains only the plain password, without URL encoding. Mount it into the BlockyUI container at that path. This lets BlockyUI read the same password file as your database container instead of requiring a separate secret containing the full connection URL. Inline passwords in structured targets also use plain text, so characters such as `@` and `#` do not need URL encoding.
