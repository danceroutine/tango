---
'@danceroutine/tango-migrations': minor
'@danceroutine/tango-resources': minor
'@danceroutine/tango-codegen': minor
'@danceroutine/tango-testing': minor
'@danceroutine/tango-schema': minor
'@danceroutine/tango-core': minor
'@danceroutine/tango-cli': minor
'@danceroutine/tango-orm': minor
---

Add typed relation hydration for Tango querysets.

Querysets can now hydrate direct single-valued relations with `selectRelated(...)` and reverse collection relations with `prefetchRelated(...)`. Relation hydration is typed from field-authored relation metadata, with `t.modelRef<TModel>(...)` providing a typed string-reference path for projects that want runtime model-key decoupling without losing TypeScript result typing.

This also moves relation-aware query planning through the SQL validation layer, adds compiler-owned prefetch SQL generation, and updates ORM result typing so selected model fields and hydrated relation properties compose correctly.
