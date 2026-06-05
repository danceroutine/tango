---
"@danceroutine/tango-core": patch
"@danceroutine/tango-adapters-express": patch
---

Fix response cookie intent handling so repeated `setCookie()` calls replace the prior cookie for the same name, domain, and path while `appendCookie()` continues to emit additional `Set-Cookie` lines. Express responses now forward multiple `Set-Cookie` lines without collapsing them into a single header value.
