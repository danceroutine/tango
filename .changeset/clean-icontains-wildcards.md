---
"@danceroutine/tango-resources": patch
---

- `FilterSet` now passes raw `icontains` values to the ORM so SQL wildcard wrapping happens once in the query compiler.
