---
"blocky-ui": patch
---

Log why a log source can't be read. When the dashboard shows "Unable to read this log source.", the server log now has the source and the reason, like a refused connection or a wrong password, so a misconfigured source is easier to fix. Unexpected server errors are now logged in production too.
