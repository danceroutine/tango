---
"@danceroutine/tango-migrations": patch
---

Fix `migrate` and `status` failure handling so a migration error remains the reported failure when closing the database connection afterward also fails. Failed runs now release the connection, and teardown problems are logged separately.
