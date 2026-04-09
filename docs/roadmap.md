# Roadmap

The roadmap below outlines major areas of future work for Tango.

It will change as the framework evolves. For the current supported surface, see [Supported and unsupported features](/guide/supported-and-unsupported).

## What is on the roadmap?

### Deeper relation hydration

Tango supports one-level relation hydration for `belongsTo`, `hasOne`, and `hasMany` relations through `selectRelated(...)` and `prefetchRelated(...)`.

Future relation work should extend that foundation to nested traversal such as `author__profile`, related-row projection, many-to-many hydration, and ambient or generated typing that removes explicit target-model generics from reverse relation calls.

### Transaction ergonomics beyond `atomic(...)`

The core ORM transaction boundary is now `transaction.atomic(async (tx) => ...)`, including nested savepoints and post-commit work through `tx.onCommit(...)`.

The base transaction contract is in place now, so the remaining work is mostly about fit and ergonomics. The main follow-up questions are request-scoped wrappers in host adapters, broader multi-database routing, and better SQLite ergonomics beyond the current file-backed transaction boundary.

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

## Related pages

- [Supported and unsupported features](/guide/supported-and-unsupported)
