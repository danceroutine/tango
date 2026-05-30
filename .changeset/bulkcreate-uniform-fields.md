---
'@danceroutine/tango-orm': patch
---

Fix `bulkCreate(...)` so batches with mismatched row shapes fail clearly after hook processing instead of silently dropping extra keys or inserting `undefined` values.

---