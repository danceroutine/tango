# Schema API reference

`@danceroutine/tango-schema` provides the model, metadata, and model-hook contracts the rest of Tango builds on.

## Top-level exports

The root export includes:

- namespace barrels `domain` and `model`
- `Model`
- `RelationBuilder`
- `ModelRegistry`
- helpers `c`, `i`, `m`, and `t`
- `ModelDefinition`
- schema domain types such as `Field`, `FieldType`, `RelationDef`, `RelationType`, `IndexDef`, and `ModelMetadata`
- model hook types such as `ModelWriteHooks`

## `Model(definition)`

`Model(definition)` creates and registers a Tango model, combining a Zod schema with the metadata and model lifecycle hooks that the rest of the framework relies on.

### Required fields

- `namespace: string`
- `name: string`
- `schema: z.ZodObject<...>`

### Optional fields

- `table?: string`
- `fields?: Field[]`
- `indexes?: IndexDef[]`
- `relations?: (builder: RelationBuilder) => Record<string, RelationDef>`
- `ordering?: string[]`
- `managed?: boolean`
- `defaultRelatedName?: string`
- `constraints?: unknown[]`
- `hooks?: ModelWriteHooks<TModel>`

### Behavior

`Model(definition)` does the following:

- throws if `namespace` is empty
- throws if `name` is empty
- throws if `table` is provided but empty
- derives `table` from `name` when omitted
- infers fields from the Zod schema when `fields` is not provided
- preserves model write hooks on the returned model object
- registers the result in the global `ModelRegistry`

## Model lifecycle hooks

The `hooks` field is where application code declares model-owned write lifecycle behavior.

Available hooks include:

- `beforeCreate`
- `afterCreate`
- `beforeUpdate`
- `afterUpdate`
- `beforeDelete`
- `afterDelete`
- `beforeBulkCreate`
- `afterBulkCreate`

`before*` hooks may return normalized data to persist.

`after*` hooks run after the write succeeds.

These hooks execute inside `Model.objects`, so they apply across serializers, resources, scripts, and direct manager usage.

## `ModelRegistry`

The registry stores and resolves models, especially for relations.

Public methods include:

- `register(model)`
- `registerMany(models)`
- `get(namespace, name)`
- `getByKey(key)`
- `resolveRef(ref)`
- `clear()`

## Metadata helpers

### `t`

Field-level helper functions used inside schemas. The current docs and examples use these most often:

- `t.primaryKey(...)`
- `t.unique(...)`
- `t.default(...)`
- `t.foreignKey(...)`

### `m`

Model-level metadata helpers:

- `m.ordering(...)`
- `m.managed(value)`
- `m.defaultRelatedName(value)`
- `m.indexes(...)`
- `m.constraints(...)`
- `m.uniqueTogether(...)`
- `m.indexTogether(...)`
- `m.merge(...)`

### `c` and `i`

These helpers support constraint and index construction. They are lower-level tools than `Model(...)` and the field helpers, so most applications will only need them when table metadata becomes more specialized.

## Related pages

- [Models and schema](/topics/models-and-schema)
- [Model lifecycle hooks](/topics/model-lifecycle-hooks)
- [Migrations](/topics/migrations)
