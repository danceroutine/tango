# Supported and unsupported features

Tango covers a deliberate slice of application development. It gives you model metadata, query composition, migrations, resource behavior, configuration, and host-framework adapters. Your host framework still owns routing, middleware, rendering, and the rest of the application runtime.

This choice was made because there are many pre-existing mature web frameworks that have solved the missing layers more comprehensively, and for a wider array of technologies, than Tango can reasonably support on it's own.

Tango aims to cover a substantial part of the day-to-day work for data modeling and API development. Django's broader runtime surface, including the parts that own a full web application from top to bottom, still extends beyond Tango's current boundary.

## Which parts of the stack does Tango cover today?

### Project setup and configuration

A Tango application can centralize its environment-specific database settings in `tango.config.ts`, load them at runtime, and reuse that same config for `tango migrate` and `tango make:migrations`.

The scaffold workflow is also part of the supported surface. `tango new` can generate Tango-backed projects for Express, Next.js App Router, and Nuxt, and the generated projects already know how to wire Tango config, migrations, and a starter resource layer together.

### Models, schema, and persistence rules

Models start with Zod-first definitions through `Model(...)`. A model can declare stable identity through `namespace` and `name`, field metadata such as primary keys and foreign keys, relation metadata, indexes, defaults, and model lifecycle hooks.

That model metadata is not isolated to one package. The same contract feeds migrations, relation resolution, manager creation, and OpenAPI-oriented resource descriptions, which is why the model layer sits near the center of the framework.

### ORM and data access

The ORM layer already includes model managers through `Model.objects`, immutable `QuerySet` composition, boolean query composition through `Q`, field projection through `select(...)`, fetched-record type narrowing for projected fields, and nested relation hydration through `selectRelated(...)` and `prefetchRelated(...)` for `belongsTo`, `hasOne`, `hasMany`, and many-to-many relations backed by a join table.

The ORM surface is designed for application code that wants a Django-shaped querying model without giving up TypeScript-native contracts. Collection filtering, ordering, slicing, existence checks, row shaping through `fetch(...)`, manager-backed persistence, generated nested path typing, and finite cyclic traversal at runtime are all part of the current story.

The current supported ORM contract also includes `transaction.atomic(async (tx) => ...)`, nested savepoints, and post-commit callback registration through `tx.onCommit(...)`.

The remaining unsupported ORM boundary includes related-row projection, request-wide transaction wrappers, and multi-database routing for transaction work.

### Database dialects

SQLite and PostgreSQL are the built-in supported database dialects today. That support includes runtime adapters, query compilation, migration SQL compilation, schema introspection, and integration-harness coverage in the testing package.

Those two dialects are the ones application developers should treat as first-class. Other databases may become possible over time, but they are not part of the shipped support boundary yet.

### Migrations

The migration workflow already covers schema introspection, model-versus-database diffing, operation-based migration generation, migration execution, and migration journaling. In practical terms, that means you can change model metadata, generate a migration file, review the operations, and apply the migration through the CLI.

The migration layer currently ships with the SQL compilers and introspectors needed for SQLite and PostgreSQL. When you are building on one of those dialects, migrations are a core part of the supported framework workflow rather than a separate add-on.

### Resources and API behavior

The resource layer already includes `APIView`, `GenericAPIView`, and `ModelViewSet` for API-facing behavior. That includes request validation through serializers, model-backed CRUD flows, custom viewset actions, adapter-neutral request handling through `RequestContext`, query filtering through `FilterSet`, and both offset and cursor pagination.

This is the part of the framework that feels closest to Django REST Framework. The resource layer owns the application-facing API contract, while the host adapter translates between Tango's request and response model and the concrete framework runtime.

### Host-framework adapters

Adapters ship for Express, Next.js App Router, and Nuxt Nitro. Those adapters turn host requests into `RequestContext`, delegate to Tango resources, and convert the resulting `TangoResponse` back into the host framework's response shape.

Application code can often keep the same serializers, model hooks, viewsets, and querying patterns while changing the surrounding host framework. The supported examples exercise that portability across Express, Next.js, and Nuxt.

### OpenAPI generation

OpenAPI 3.1 generation is available through `@danceroutine/tango-openapi`. A project can describe viewsets, generic views, and plain API views, build a document object, and then publish that document through the host framework as a normal JSON endpoint.

That support is strongest when the API surface is expressed through Tango resources, because the OpenAPI package can derive much of the contract directly from the same abstractions the runtime already uses.

### Testing support

The testing package includes unit-test mocks for manager and query contracts, model data factories, dialect-aware integration harnesses, and Vitest helpers. SQLite and PostgreSQL both have harness support, which means Tango's current testing story covers the same two dialects that the runtime and migrations layers treat as first-class.

For application developers, that means Tango already includes practical testing support for query behavior, migrations, and adapter-backed integration paths, even though application-specific end-to-end coverage still belongs to the host project.

## Which parts still belong to the host framework?

Host frameworks continue to own routing declarations, middleware order, request authentication, session handling, HTML rendering, static asset delivery, and deployment-specific runtime behavior.

Tango focuses on the application-facing layers that historically are assembled from disparate tooling and can benefit from the opinionated and standardized development model that Django introduced in their own framework. The host framework remains the right place for page rendering, framework-specific request policies, and the larger runtime environment around the Tango layers, that have been solved effectively by other framework providers in the ecosystem.

## Which major Django and DRF features are outside Tango today?

### A Django-style full-stack runtime

Django's project-and-app runtime model sits outside Tango's current scope. Applications continue to rely on the host framework for URL configuration, middleware orchestration, template rendering, and the larger server runtime.

### An admin site

An admin interface comparable to Django admin is not part of Tango today. Applications that need an internal back-office UI still need to build that interface in the host application or bring in another tool for it.

### Django forms and template rendering

A forms framework, a server-rendered template engine, and a page-oriented component model are also outside Tango's current scope. The Next.js and Nuxt examples render pages through their own frameworks, and the Express example stays API-only.

### A full DRF authentication and policy stack

Tango resources can receive authenticated user state through `RequestContext`, and the core package includes standard error types such as `AuthenticationError` and `PermissionDenied`. Authentication backends, permission classes, throttling, renderer negotiation, and the larger policy surface associated with Django REST Framework are not part of the current Tango resource layer.

### Additional built-in SQL dialects

MySQL, MariaDB, SQL Server, and other SQL backends are not built-in Tango dialects today. Supporting a new dialect requires runtime, migration, testing, config, and CI work before that backend can be treated as part of the supported surface.

MariaDB is the SQL dialect currently called out on the roadmap, but it is not part of the supported database surface yet.

## Which current gaps are already on the roadmap?

Several unsupported areas already have explicit follow-up work planned.

At the ORM level, the roadmap includes related-row projection and transaction ergonomics beyond the core `atomic(...)` API such as request-scoped wrappers and broader multi-database routing.

At the platform level, the roadmap also includes MariaDB support, GraphQL support, custom Tango environments beyond `development`, `test`, and `production`, non-linear migration dependency chains for larger teams, agentic development support for AI-assisted workflows, and longer-term exploration of NoSQL support.

The roadmap page tracks those items as they evolve. The support boundary describes current framework behavior rather than promising that every planned item will arrive on a fixed schedule.

## Related pages

- [Overview](/guide/overview)
- [Installation](/guide/installation)
- [Roadmap](/roadmap)
- [Architecture](/topics/architecture)
- [API layer](/topics/api-layer)
