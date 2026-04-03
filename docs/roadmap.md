# Roadmap

The roadmap below outlines major areas of future work for Tango.

It will change as the framework evolves. For the current supported surface, see [Supported and unsupported features](/guide/supported-and-unsupported).

## What is on the roadmap?

### Relation hydration from `selectRelated(...)`

`selectRelated(...)` already gives the ORM enough relation metadata to plan SQL joins through declared `belongsTo` relationships.

The next immediate improvement in this area is to hydrate related model data into the returned row shape, so queries that join an author can expose typed access to fields such as `post.author.email`.

### Type narrowing from `select(...)`

`select(...)` already narrows the SQL projection so the database returns only the requested columns.

The next immediate improvement in this area is to let the TypeScript surface narrow with that projection as well, so a query such as `select(['id', 'title', 'slug'])` can produce a correspondingly narrowed result type without requiring an extra shaping step.

### ORM transaction support

The ORM currently focuses on ordinary manager-driven reads and writes.

Transaction support for application code is still missing from the supported ORM surface. A future transaction API needs to define how multi-step write workflows open a transaction boundary, how that boundary is scoped to the active runtime and database client, and how application code should use it without bypassing the normal model manager path.

### Agentic Development Support

Tango currently uses agentic skills and subagents for it's own development, and wants to package that type of development workflow to enable your own agents to understand how to work with the framework.

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
