---
"@danceroutine/tango-orm": minor
"@danceroutine/tango-schema": minor
"@danceroutine/tango-testing": minor
---

Add a supported ORM transaction API centered on `transaction.atomic(async (tx) => ...)`, nested savepoints, and `tx.onCommit(...)`.

Extend schema write-hook args with a narrow transaction callback contract so hooks can register post-commit work without depending on ORM internals.

Add testing fixtures and client contract updates needed to exercise the new runtime-backed transaction workflow.
