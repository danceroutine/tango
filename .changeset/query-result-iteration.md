---
'@danceroutine/tango-orm': minor
---

`QuerySet.fetch()` returns a concrete **`QueryResult`** value that you can iterate synchronously (`for...of`, spread, destructuring) and use like a small read surface (`length`, `map`, `at`, `toArray`). `QueryResult.results` remains available but is deprecated and warns once per process.

`QuerySet` is **`AsyncIterable`**: `for await (const row of queryset)` evaluates the queryset once via `fetch()` and yields each row.

Pagination helpers accept **`QueryResult` or arrays** where results are passed into paginator response builders.
