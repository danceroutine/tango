---
"@danceroutine/tango-migrations": patch
---

Close migration CLI database clients on `migrate` and `status` failure paths, preserve the primary command error when cleanup also fails, and log close failures instead of masking the original failure.
