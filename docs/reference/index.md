# Reference

Use the reference section when you already know which Tango subsystem you are working with and need exact names, fields, methods, or option semantics.

Reference pages are not the best place to learn a subsystem from scratch. For first-pass learning, start with the [Guide](/guide/), [Topics](/topics/), or the [How-to guides](/how-to/). Come back to reference when you need the precise public contract.

## Reference pages

- [CLI API](/reference/cli-api): the `tango` executable, its built-in commands, and the small programmatic CLI surface
- [Config API](/reference/config-api): the `tango.config.*` contract and the loader helpers that resolve it
- [OpenAPI API](/reference/openapi-api): the descriptor helpers and generators for building OpenAPI documents from Tango resources
- [ORM query API](/reference/orm-query-api): the exact manager, query, and adapter contracts behind `Model.objects` and `QuerySet`
- [Resources API](/reference/resources-api): the resource-layer classes for serializers, views, filtering, and pagination
- [Schema API](/reference/schema-api): the model, metadata, registry, and helper contracts that the rest of Tango builds on

## Choosing the right docs section

Use [Guide](/guide/) when you are still orienting yourself to Tango as a framework.

Use [Tutorials](/tutorials/) when you want to follow a working application end to end.

Use [Topics](/topics/) when you want the mental model for a subsystem such as the ORM, the API layer, or migrations.

Use [How-to guides](/how-to/) when you already know the goal and want the shortest path to completing it.
