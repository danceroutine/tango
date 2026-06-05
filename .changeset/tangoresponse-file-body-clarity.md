---
'@danceroutine/tango-core': minor
---

Clarify `TangoResponse.file()` and `TangoResponse.download()` so the first argument is response body bytes, not a filesystem path. Remove `string` from the accepted body type, rename the parameter to `body`, and add `TangoHeaders.setContentTypeForBody()` as the preferred helper. `setContentTypeByFile()` remains as a deprecated proxy.
