---
"@danceroutine/tango-schema": minor
"@danceroutine/tango-orm": minor
"@danceroutine/tango-testing": minor
"@danceroutine/tango-migrations": patch
"@danceroutine/tango-codegen": patch
---

Add decorator-owned relation resolution and field metadata APIs.

Schema now supports object-form relation decorator configs, decorator-level relation naming, resolved relation graph finalization, and the fluent `t.field(...).build()` scalar metadata builder. ORM model metadata now consumes the resolved relation graph for relation metadata and aliases. Testing adds `withGlobalTestApi` for module-loading test helpers. Migrations now load model modules through a registry-aware loader, and codegen templates emit the new fluent scalar metadata form.
