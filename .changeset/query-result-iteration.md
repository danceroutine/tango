---
'@danceroutine/tango-orm': minor
'@danceroutine/tango-resources': minor
---

Adds iterable `QueryResult` values from `QuerySet.fetch()`, async iteration over `QuerySet`, and Django-style caching for repeated row-returning evaluation of the same queryset instance. Paginator builders now accept either arrays or `QueryResult` values. The legacy `QueryResult.results` getter remains available for compatibility and now emits a one-time deprecation warning.
