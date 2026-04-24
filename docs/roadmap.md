# Roadmap

The roadmap below outlines major areas of future work for Tango.

It will change as the framework evolves. For the current supported surface, see [Supported and unsupported features](/guide/supported-and-unsupported).

## What is on the roadmap?

### Related-row projection

Tango supports nested relation traversal such as `author__profile` and `posts__comments__author`, together with generated path typing that removes most explicit reverse target-model generics in the common case.

The next relation work focuses on related-row projection: fetching related fields into the shape of one queryset result without treating every hop as a separate hydration graph step.

### Many-to-many Django-parity follow-ups

Many-to-many hydration and join-row writes now share the resolved through-table metadata path, and persisted records expose a related manager that supports `add(...)`, `remove(...)`, and `all()` against the active runtime client. Follow-up work includes reverse-side naming for many-to-many, inverse edges in the resolved graph, the bulk `set(...)` helper, the `clear()` helper, `create(...)` on the related manager, and richer symmetry helpers beyond the current join-row link helpers.

### Transaction ergonomics beyond `atomic(...)`

The core ORM transaction boundary is now `transaction.atomic(async (tx) => ...)`, including nested savepoints and post-commit work through `tx.onCommit(...)`.

The base transaction contract is in place, so the remaining work is mostly about fit and ergonomics. The main follow-up work is request-scoped wrappers in host adapters, broader multi-database routing, and better SQLite ergonomics beyond the current file-backed transaction boundary.

### Agentic Development Support

Tango currently uses agentic skills and subagents for its own development, and wants to package that type of development workflow to enable your own agents to understand how to work with the framework.

### NoSQL support

Tango currently assumes a relational database model. Models, query composition, migrations, and much of the API layer are built around that assumption.

NoSQL support would expand Tango beyond that boundary but will require new answers for modeling, querying, and schema evolution across non-relational backends.

### MariaDB support

MariaDB is a natural SQL expansion for Tango.

It fits the framework's current relational architecture, but it still needs the same level of support that SQLite and PostgreSQL already have today: runtime adapter support, query compilation, migration SQL compilation, schema introspection, integration testing, and CI coverage.

### GraphQL support

Tango currently focuses on REST-style APIs through its existing API layer.

GraphQL support would add another way to expose application contracts. One of the main design questions is how much model and serializer metadata should be shared between REST-style resources and a future GraphQL surface.

### Custom environments in Tango

`tango.config.ts` currently treats `development`, `test`, and `production` as the fixed environment set.

Custom environments would make it easier to represent `staging`, `preview`, `qa`, and other deployment targets directly in Tango's configuration and CLI workflows.

### Non-linear migration dependency chains

Tango migrations are currently one ordered sequence.

That works well for straightforward deployment flows, but larger teams often end up doing schema work in parallel across multiple branches. Support for non-linear dependencies, merge-aware migration workflows, or both would make that work easier to review, verify, and deploy safely.

### ORM query API conveniences (Django-style)

Tango's queryset and manager layer is growing toward familiar Django ergonomics. The following are not part of the current supported contract in this document, but they are the main follow-up items for human planning: `values()` and `valuesList()`-style column projections, `distinct()`, `selectForUpdate()` and other row-locking modes, database-level `aggregate()` and per-row `annotate()`, and related SQL features that need a consistent story across dialects and transactions.

## Related pages

- [Supported and unsupported features](/guide/supported-and-unsupported)
