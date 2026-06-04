---
'@danceroutine/tango-codegen': patch
'@danceroutine/tango-migrations': patch
'@danceroutine/tango-orm': patch
---

Scaffolded projects now install database packages for the selected dialect, and SQLite runtimes can start with SQLite-only dependencies.

SQLite scaffolds include `better-sqlite3`, `@types/better-sqlite3`, and the matching native build allowlist. Postgres scaffolds include `pg` and `@types/pg`, with a package manifest scoped to Postgres packages.

Migration generation now applies Postgres `serial` primary key projection for Postgres configs while preserving SQLite integer primary keys. SQLite runtime adapter setup also succeeds with SQLite-only dependencies.
