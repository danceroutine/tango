---
'@danceroutine/tango-core': minor
'@danceroutine/tango-orm': minor
'@danceroutine/tango-testing': minor
---

Added Django-style single-record query conveniences across Tango's ORM surface. `Model.objects` now exposes `all()`, `getOrCreate(...)`, and `updateOrCreate(...)`, while `QuerySet` now exposes `all()`, `first()`, `last()`, and strict `get(...)` lookup behavior.

`@danceroutine/tango-core` now exports `MultipleObjectsReturned` so ambiguous single-record lookups can fail with a dedicated error, and `@danceroutine/tango-testing` updates `aManager(...)` so tests can mock the new manager helpers directly.
