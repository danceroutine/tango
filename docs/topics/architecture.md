# Architecture

Tango is designed as a layered toolkit that sits inside a host runtime rather than replacing it. That decision shapes every package in the repository and explains why the examples can move between Express and Next.js without rewriting their application-facing Tango layers.

## The central architectural decision

Tango keeps host-framework concerns separate from framework-domain concerns so the same primitives can be reused across multiple runtimes.

Express or Next.js still owns routing, middleware order, rendering, and request lifecycle behavior. Tango owns model metadata, query composition, migrations, resource classes, and the adapter contracts that connect those abstractions to the host.

## The layers

### Schema layer

`@danceroutine/tango-schema` defines model identity, field metadata, relation metadata, indexes, and registry behavior. The schema layer uses Zod as the canonical validation surface, which keeps runtime validation and TypeScript types close to the application code that consumes them.

### Data layer

`@danceroutine/tango-orm` provides the transparent runtime, `Model.objects`, `QuerySet`, `Q`, adapters, repositories, and `UnitOfWork`. Most application code lives on the model-first path, while repositories remain available for lower-level persistence boundaries.

### Migration layer

`@danceroutine/tango-migrations` introspects an existing database, compares it to model metadata, generates migration operations, compiles those operations to dialect-specific SQL, and applies them through `MigrationRunner`.

### Resource layer

`@danceroutine/tango-resources` translates model-backed data access into HTTP behavior through `APIView`, generic CRUD views, `ModelViewSet`, filtering, pagination, and an adapter-neutral `RequestContext`.

### Adapter layer

The adapter packages connect Tango's resource classes to concrete host runtimes. Their job is translation rather than policy: convert framework requests into `RequestContext`, invoke the Tango resource layer, and write the resulting response back to the host framework.

## Request flow

When a request reaches a Tango endpoint, the sequence is straightforward:

1. the host framework receives the request
2. the adapter translates it into Tango's request model
3. the view class or viewset applies validation, filtering, ordering, and pagination rules
4. the model manager and `QuerySet` layer perform the read or write operations
5. the adapter serializes the response back to the host framework

Each layer handles one kind of responsibility, so the path from request to query remains readable and testable.

## Schema evolution flow

Schema changes move through a similarly explicit sequence:

1. a model definition changes
2. Tango introspects the database
3. `diffSchema()` computes the required migration operations
4. a migration file is generated or updated
5. the migration runner applies the operations and records them in the journal table

That pipeline stays inspectable from end to end, which makes it practical to review migration intent before it runs and verify convergence after it completes.

## Why this architecture holds up over time

The boundaries remain useful because they match the way developers already reason about their applications: model definition, data access, schema evolution, HTTP behavior, and runtime integration.

That division also improves long-term maintenance. A change to `FilterSet` should mainly affect the resource layer and its adapters. A change to model metadata should primarily affect schema, migrations, and the data layer. When the boundaries stay disciplined, the blast radius of a change remains understandable.

## Common architectural mistakes

The most common mistakes collapse those boundaries:

- passing Express or Next.js request objects into persistence code
- putting query-string parsing inside data-access methods
- encoding migration policy in runtime startup code
- letting adapters add business logic instead of translation logic

Each of those choices makes the code harder to test because it ties one layer to assumptions that belong somewhere else.

## Related pages

- [Models and schema](/topics/models-and-schema)
- [ORM and repositories](/topics/orm-and-repositories)
- [Resources and viewsets](/topics/resources-and-viewsets)
- [Migrations](/topics/migrations)
