---
'@danceroutine/tango-adapters-core': patch
'@danceroutine/tango-adapters-express': patch
'@danceroutine/tango-adapters-next': patch
'@danceroutine/tango-adapters-nuxt': patch
'@danceroutine/tango-cli': patch
'@danceroutine/tango-codegen': patch
'@danceroutine/tango-config': patch
'@danceroutine/tango-core': patch
'@danceroutine/tango-migrations': patch
'@danceroutine/tango-openapi': patch
'@danceroutine/tango-orm': patch
'@danceroutine/tango-resources': patch
'@danceroutine/tango-schema': patch
'@danceroutine/tango-testing': patch
---

Align published package entrypoints with `tsdown`'s `.mjs` and `.d.mts` output after the build-tool upgrade so generated imports, migrations commands, and framework smoke paths resolve correctly in CI.
