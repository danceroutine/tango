---
'@danceroutine/tango-core': patch
---

Standardize `TangoResponse.methodNotAllowed()` and framework adapter 405/404 responses on the Tango error envelope so clients receive `{ error: { code, message } }` with `application/problem+json` instead of legacy `{ error: string }` JSON.
