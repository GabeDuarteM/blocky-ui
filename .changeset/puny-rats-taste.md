---
"blocky-ui": patch
---

Docker images are now published to **GitHub Container Registry** (GHCR)

#### New Registry

Blocky UI Docker images are now available on GitHub Container Registry at `ghcr.io/gabeduartem/blocky-ui`.

Update your `docker-compose.yml` to use the new registry:

```yaml
services:
  blocky-ui:
    image: ghcr.io/gabeduartem/blocky-ui:latest
```

Or if using `docker run`:

```bash
docker run -d ghcr.io/gabeduartem/blocky-ui:latest
```

#### Docker Hub Deprecation Notice

The existing Docker Hub image (`gabrielduartem/blocky-ui`) will continue to receive updates for the time being, but **may be discontinued in the future**. We recommend updating your configuration to use the GHCR image to avoid disruption.
