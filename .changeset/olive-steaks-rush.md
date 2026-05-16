---
'@danceroutine/tango-adapters-core': minor
'@danceroutine/tango-adapters-express': minor
'@danceroutine/tango-adapters-next': minor
'@danceroutine/tango-adapters-nuxt': minor
---

Add opt-in request-scoped write transactions to the Express, Next.js, and Nuxt adapters.

Setting `transaction: 'writes'` on an adapted resource now wraps `POST`, `PUT`, `PATCH`, and `DELETE` handlers in a single `transaction.atomic(...)` boundary, so multi-step writes can commit or roll back as one request-level unit. `GET`, `HEAD`, and `OPTIONS` continue to run outside that wrapper.

The first release is scoped to the Tango runtime your application installs as its default runtime. It keeps the existing nested transaction and `tx.onCommit(...)` semantics, and it leaves request abort and disconnect handling to the follow-up design work tracked separately.
