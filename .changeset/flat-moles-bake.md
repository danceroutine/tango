---
'@danceroutine/tango-codegen': minor
'@danceroutine/tango-migrations': minor
'@danceroutine/tango-openapi': patch
'@danceroutine/tango-orm': minor
'@danceroutine/tango-resources': minor
'@danceroutine/tango-schema': minor
'@danceroutine/tango-testing': patch
---

Ship Tango's first complete many-to-many workflow across schema, migrations, ORM, resources, and testing.

- Add implicit through-table synthesis and migration support so `t.manyToMany(...)` works without an explicit join model for the common case.
- Add many-to-many related managers, relation-aware filtering, and query support so application code can read and manipulate memberships directly.
- Add DRF-shaped serializer relation fields for many-to-many reads and writes, including primary-key and slug-list workflows.
