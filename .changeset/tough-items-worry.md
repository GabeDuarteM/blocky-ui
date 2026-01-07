---
"blocky-ui": minor
---

Add optional instance name in browser tab title

#### Custom instance name

When running multiple BlockyUI instances, you can now set an `INSTANCE_NAME` environment variable to display a custom name in the browser tab title (e.g., "BlockyUI @ blocky-vm2").

To enable, add the environment variable to your configuration:

```sh
INSTANCE_NAME=blocky-vm2
```
