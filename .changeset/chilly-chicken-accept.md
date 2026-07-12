---
"blocky-ui": major
---

Remove deprecated configuration and distribution compatibility.

#### Breaking changes

##### Query log configuration

`DATABASE_URL` has been deprecated since v1.2.0 and is now no longer accepted. Configure the query log provider explicitly:

```env
QUERY_LOG_TYPE=mysql
QUERY_LOG_TARGET=mysql://username:password@localhost:3306/blocky_query_log
```

##### Container registry

The Docker Hub image (`gabrielduartem/blocky-ui`) has been deprecated since v1.4.0 and will no longer receive updates. Pull releases from GitHub Container Registry instead:

```yaml
image: ghcr.io/gabeduartem/blocky-ui:v2.0.0 # or :latest
```
