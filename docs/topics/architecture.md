# Architecture

Tango organizes application work into a small set of layers that build on one another. That structure gives application code one place for stored-record definitions, another for database access, another for schema evolution, and another for HTTP-facing API behavior.

The result is a framework that can keep its own application-facing contracts consistent while still fitting into host frameworks such as Express, Next.js, and Nuxt.

## The main architectural idea

Tango concentrates on the parts of application development that sit closest to data contracts and API contracts.

The host framework still owns routing, middleware order, rendering, static assets, and the larger request lifecycle. Tango owns model metadata, ORM queries, migrations, API resources, and the adapters that connect those abstractions to the host runtime.

That division is what gives the framework its shape. Tango gives application code a consistent model, query, migration, and resource architecture that can be used inside more than one host framework.

## The layers

### Models and schema

The model layer describes stored records.

This is where Tango learns what data exists, how records are identified, how they relate to one another, and which persistence rules belong to the record itself. Models begin from Zod schemas and then add the metadata needed for database behavior, relation resolution, and higher-level framework features.

### ORM and queries

The ORM layer turns those models into a database access surface.

This is where `Model.objects`, `QuerySet`, and query composition live. Application code uses this layer to create records, retrieve records, refine database queries, and shape result sets. The ORM reads the model contract directly, so application code does not need a second persistence definition alongside the model.

### Migrations

The migration layer turns model changes into schema history.

When a model changes in a way that affects tables, columns, relations, or indexes, the migration layer records how the database should move from one schema state to the next. This keeps the live database aligned with the model contract that application code is using.

### API resources

The API layer turns models and queries into HTTP behavior.

This is where serializers, `APIView`, generic views, viewsets, filtering, and pagination live. The API layer decides which operations belong to a resource, which request payloads are accepted, which response shapes are returned, and which list-query features are part of the public contract.

### Adapters

The adapter layer connects Tango's API resources to the surrounding host framework.

An adapter receives the host framework's request object, builds Tango's request context, calls the resource class, and translates the resulting Tango response back into the host framework's response type. This keeps the HTTP contract defined in Tango while still letting the host framework run the actual server lifecycle.

## Request flow

When an HTTP request reaches a Tango-backed endpoint, the path through the layers is usually straightforward.

The host framework receives the request first. The adapter turns that request into Tango's request context and passes it to the resource class. The resource validates input, applies public filtering or pagination rules when needed, and calls into the ORM for reads or writes. The ORM works from the model contract and the current database state. The adapter then translates the resulting Tango response back into the host framework's response type.

## Schema evolution flow

Model changes also move through the architecture in a predictable order.

An application changes a model first. If that change affects stored schema, Tango compares the declared model contract with the current database schema and produces a migration that records the next schema step. The migration is reviewed, committed with the model change, and then applied so the database and the model contract stay aligned.

Migrations belong in the architecture because they are the layer that keeps model changes meaningful once real databases and deployed environments enter the picture.

## Related pages

- [Models and schema](/topics/models-and-schema)
- [ORM and QuerySets](/topics/orm-and-querysets)
- [API layer](/topics/api-layer)
- [Migrations](/topics/migrations)
