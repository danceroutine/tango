---
'@danceroutine/tango-orm': patch
---

Fix `QuerySet.exists()` so `limit(0)` and `offset` use the same query window as `fetch()` and `count()`, while keeping the `SELECT 1 ... LIMIT 1` existence probe for performance optimization.
