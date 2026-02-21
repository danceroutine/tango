# Supported and unsupported features

Tango's current scope is defined here in concrete terms so application developers and contributors can understand what the framework already covers, what it leaves to host runtimes, and which areas are still likely to evolve.

## What Tango currently supports

### Modeling and schema

Tango already supports Zod-first model definitions, explicit model identity through `namespace` and `name`, field metadata decorators, relation metadata, and registry-based relation resolution. Those features live in `@danceroutine/tango-schema` and form the basis for migrations, repositories, and other tooling.

### Data access

Tango already supports repositories, immutable `QuerySet` composition, boolean query composition through `Q`, database adapters for SQLite and PostgreSQL, and transaction coordination through `UnitOfWork`.

### Migrations

Tango already supports schema introspection, model-versus-database diffing, operation-based migrations, SQL compilation for the built-in dialects, and migration execution through the runner and CLI.

### API resources

Tango already supports class-based API views, generic CRUD views, `ModelViewSet`, query filtering through `FilterSet`, offset and cursor paginator implementations, and an adapter-neutral request context.

### Testing

Tango already supports testing mocks, model data factories, integration harnesses for SQLite and PostgreSQL, and Vitest helper integration through `vi.tango`.

## What Tango intentionally leaves out

### Full Django runtime parity

Tango does not attempt to reproduce Django's project and app runtime model. The framework is designed to live inside an existing host runtime, so application bootstrapping, routing trees, middleware order, and rendering remain responsibilities of Express, Next.js, or another host framework.

### Django admin parity

Tango does not currently include an admin interface or a package that aims to reproduce Django admin. That work would require a large user-interface and runtime surface area, which is outside the current package boundaries.

### Full Django ORM parity

Tango does not try to match every Django ORM feature. The current ORM layer prioritizes explicit behavior, typed contracts, and cross-dialect clarity over feature breadth.

### Full DRF renderer and content-negotiation parity

Tango does not implement a full renderer stack or content-negotiation system comparable to Django REST Framework. The host runtime already imposes request and response conventions, and Tango focuses on resource behavior that remains useful across those runtimes.

### Automatic discovery across arbitrary package boundaries

Tango does not depend on implicit discovery of models or relations across packages. The framework uses explicit exports, stable model identity, and registry resolution because those choices are easier to reason about and much easier to test.

## Areas that are likely to grow

Some parts of the framework are already visible as natural expansion points:

- richer relationship ergonomics
- broader backend support
- more expressive query features
- higher-level authentication and permission integration in the resource layer

These are good candidates for future work, but they should be treated as open areas rather than promised roadmap items unless the repository explicitly says otherwise.

## Reading this page

Use this page when you are evaluating fit. If a feature is listed as supported here, the rest of the documentation should explain how to use it and the codebase should expose it through public packages. If a feature is listed as unsupported, contributors should avoid implying that it exists through example code or marketing copy.

## Related pages

- [Architecture](/topics/architecture)
- [Overview](/guide/overview)
