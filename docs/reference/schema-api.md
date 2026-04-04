# Schema API

`@danceroutine/tango-schema` is the package that declares Tango models. It gives application code one place to describe record shape, database metadata, relations, and model-owned write hooks. The ORM, migrations, resources, and OpenAPI layers all build on that model contract.

Most application code imports the schema surface from the package root:

```ts
import { Model, ModelRegistry, c, i, m, t } from '@danceroutine/tango-schema';
import { z } from 'zod';
```

`Model(...)` is the entrypoint most application code starts with. The remaining exports support field metadata, reusable model metadata, explicit indexes and constraints, model lookup, and framework-level extension work.

## `Model(...)`

`Model(...)` creates a Tango model from a Zod object schema and a model definition object. The returned model carries the Zod schema, the derived metadata Tango needs later, and any write hooks you declared. Tango also registers the model on the shared `ModelRegistry` before returning it, so the rest of the framework can resolve it by key.

```ts
const PostModel = Model({
    namespace: 'blog',
    name: 'Post',
    schema: z.object({
        id: t.primaryKey(z.number().int()),
        title: z.string(),
        slug: t.unique(z.string()),
        authorId: t.foreignKey('blog/User', z.number().int()),
    }),
    relations: (r) => ({
        author: r.belongsTo('blog/User', 'authorId'),
    }),
    ordering: ['-id'],
});
```

`Model(...)` accepts a `ModelDefinition<TSchema>`. In practice, that definition is easier to understand in a few groups.

### Identity and schema

`namespace` and `name` are required. Together they form the model key, such as `blog/Post`, which is how registries and relation metadata refer to the model later. They also provide the default basis for derived names such as the table name.

`schema` is also required. It must be a Zod object schema. Tango keeps that schema on the model and uses it as the source of truth for field inference when you do not provide explicit `fields`.

### Table and field metadata

`table` lets you override Tango's default table-name derivation. Leave it out when the derived plural snake-case table name is good enough. Set it when the database table name must be fixed explicitly.

`fields` lets you provide explicit `Field[]` metadata instead of relying on inference from the Zod schema and field decorators. Most application code can omit it. Reach for it when generated field metadata is not the shape you want to publish to the rest of Tango.

```ts
const PostModel = Model({
    namespace: 'blog',
    name: 'Post',
    schema: z.object({
        id: z.number().int(),
        slug: z.string(),
        authorId: z.number().int(),
    }),
    fields: [
        { name: 'id', type: 'int', primaryKey: true, notNull: true },
        { name: 'slug', type: 'text', unique: true, notNull: true },
        {
            name: 'authorId',
            type: 'int',
            notNull: true,
            references: { table: 'users', column: 'id' },
        },
    ],
});
```

This explicit form is useful when you want to see or control the exact `Field` metadata Tango publishes to the rest of the framework.

### Relations and model-level metadata

`relations` lets you declare named relations through `RelationBuilder`. It fits models that need relation names such as `author`, `comments`, or `profile` for other Tango layers to read later.

This is different from `t.foreignKey(...)`. `t.foreignKey(...)` lives on the field that stores the foreign key value, such as `authorId`, and contributes field-level reference metadata. `relations` names the higher-level relationship that other Tango layers can refer to, such as `author`. In the future, we hope to deprecate this in favor of just using t.foreignKey.

On many models the two surfaces coexist. A model might use `t.foreignKey(...)` on `authorId` so the field carries database reference metadata, and also use `relations` to publish an `author` relation name. If you only need the foreign key field metadata, the field decorator may be enough. If you want a named relation surface as well, add `relations`.

`indexes` and `constraints` attach table-level database metadata to the model. They are usually built with the `i.*` and `c.*` helpers described later in this page.

`ordering` records the model's default ordering metadata.

`defaultRelatedName` records the default reverse relation name for relation-aware code that needs one.

`managed` marks whether Tango-managed schema tooling should treat the model as framework-managed. Most application models leave this at the default behavior. Set it deliberately when the table exists in the database but Tango should not try to own its lifecycle in the same way as a normal managed model.

### Write hooks

`hooks` declares model-owned write lifecycle hooks. These hooks belong to the model contract and run during writes performed through the Tango model manager. Use them for write-time behavior that should stay attached to the record itself, such as slug generation, timestamp stamping, or normalization that should apply whenever the model is created or updated through Tango's write path.

The supported hook names are:

- `beforeCreate` runs before Tango inserts a new row. Use it to normalize the incoming data before the insert happens.
- `afterCreate` runs after Tango has inserted the row. Use it when the completed create should trigger follow-up observation or side effects.
- `beforeUpdate` runs before Tango updates an existing row. Use it to normalize the patch or inspect the current row before the update is written.
- `afterUpdate` runs after Tango has updated the row. Use it when the completed update should trigger follow-up observation or side effects.
- `beforeDelete` runs before Tango deletes an existing row. Use it when delete-time logic needs to inspect the current row before it is removed.
- `afterDelete` runs after Tango has deleted the row. Use it when follow-up work should happen only once the delete has completed.
- `beforeBulkCreate` runs before Tango inserts a batch of new rows. Use it to normalize or replace the batch before those inserts happen.
- `afterBulkCreate` runs after Tango has inserted the batch. Use it when follow-up work depends on the created records.

The `beforeCreate(...)` and `beforeUpdate(...)` hooks may return normalized values that Tango should persist. `beforeBulkCreate(...)` may return a replacement set of rows for Tango to persist. The `after*` hooks run after the write has completed.

## `RelationBuilder`

Use `RelationBuilder` inside `relations: (builder) => ({ ... })` when your model needs named relation metadata at the model level. This is the place to describe how one model points at another in application-facing terms, such as `author`, `comments`, or `profile`.

```ts
const PostModel = Model({
    namespace: 'blog',
    name: 'Post',
    schema: z.object({
        id: t.primaryKey(z.number().int()),
        authorId: t.foreignKey('blog/User', z.number().int()),
    }),
    relations: (r) => ({
        author: r.belongsTo('blog/User', 'authorId'),
    }),
});
```

`hasMany(target, foreignKey)` names a one-to-many relation from the current model to another model. It fits collection relations such as `author.posts` or `post.comments`.

`belongsTo(target, foreignKey, localKey?)` names the owning side of a relation. It fits models that carry the foreign key pointing to a parent record, such as `Post.author`.

`hasOne(target, foreignKey)` names a one-to-one relation from the current model to another model. It fits cases where one record should expose exactly one related record, such as `User.profile`.

In this builder, `target` is the target model key, usually a string such as `blog/User`. Each helper returns a `RelationDef` that Tango stores on the model metadata.

## `Decorators` and `t`

`Decorators`, also exported as `t`, attaches database-facing metadata directly to Zod fields. This solves the common problem where the field shape and the field's persistence metadata belong together, and writing them in separate places would duplicate the declaration.

```ts
const PostSchema = z.object({
    id: t.primaryKey(z.number().int()),
    slug: t.unique(z.string()),
    authorId: t.foreignKey('blog/User', z.number().int()),
});
```

### Field identity and nullability helpers

`primaryKey(...)` marks a field as the model's primary key and records it as not-null. Use it on the field that identifies the row.

`unique(...)` marks a field as uniquely constrained. Use it when one column must not contain duplicate values.

`null(...)` marks a field as nullable in Tango's field metadata. Use it when the column should explicitly allow `NULL`.

`notNull(...)` marks a field as not-null in Tango's field metadata. Use it when the schema or storage contract should state that the column must be present.

These helpers can be used directly on a schema or, for the unary helpers, as decorator factories when that reads better in composed Zod code.

### Default, column, and indexing helpers

`default(schema, value)` records an application-level default on the field contract. It fits fields that should carry a default value in Tango metadata, such as a literal string, `null`, or `{ now: true }`.

`dbDefault(schema, value)` records a database-side default expression. It fits columns where the database should provide the value rather than relying on application code to fill it in first.

`dbColumn(schema, name)` records an explicit database column name. It fits fields whose property name in application code should map to a different column name.

`dbIndex(schema)` records field-level index metadata without a separate table-level index definition. It fits single columns that should be indexed.

### Choice, validation, and display helpers

`choices(schema, values)` records an allowed choice set on the field metadata. Use it when the field should carry an explicit list of allowed values for higher-level consumers.

`validators(schema, ...values)` records additional validator functions on the field metadata. Use it when field-aware tooling should know about validators beyond the raw Zod contract.

`helpText(schema, text)` records help text on the field metadata. Use it when the field needs human-readable explanatory text.

`errorMessages(schema, map)` records custom error messages on the field metadata. Use it when the field contract should carry message overrides that higher-level tooling can inspect.

### Relation field helpers

These helpers solve the problem of declaring relation metadata on the field that stores the relation value, rather than in a separate metadata structure.

`foreignKey(target, schema?, options?)` declares a foreign-key relation. Use it on fields such as `authorId` or `postId`. If you omit the schema, Tango creates a default `z.number().int()` field for you.

`oneToOne(target, schema?, options?)` declares a one-to-one relation. Use it when the current model points to exactly one related row and the foreign-key field should also be unique. If you omit the schema, Tango again creates a default `z.number().int()` field.

`manyToMany(target, schema?)` declares many-to-many relation metadata on a field. Use it when the field itself should carry that relation information. If you omit the schema, Tango creates a default `z.array(z.number().int())` field.

Unlike `RelationBuilder`, these helpers accept the broader model-reference forms used across the schema package: a model key string, a direct model object, or a callback that returns a model.

## `Meta` and `m`

`Meta`, also exported as `m`, builds reusable model-level metadata fragments. It is useful when the same model metadata would otherwise be repeated inline, especially when several pieces belong together.

```ts
const timestampedMeta = m.merge(
    m.ordering('-id'),
    m.indexes(i.index(['createdAt'])),
    m.constraints(c.unique(['slug']))
);

const PostModel = Model({
    namespace: 'blog',
    name: 'Post',
    schema: PostSchema,
    ...timestampedMeta,
});
```

`ordering(...fields)` records default ordering fields. Use it when the model should publish a default order.

`managed(value)` records the model's managed flag as a reusable fragment. Use it when you want to opt a model into or out of Tango-managed schema handling as part of a shared metadata bundle.

`defaultRelatedName(value)` records a default reverse relation name. Use it when a model should publish that reverse name through shared metadata.

`indexes(...indexes)` wraps one or more index definitions into a fragment you can spread into `Model(...)`.

`constraints(...constraints)` wraps one or more constraint definitions into a fragment you can spread into `Model(...)`.

`uniqueTogether(...sets)` records a multi-field uniqueness rule as model metadata. It fits models where uniqueness belongs to a combination of fields rather than any one field alone.

`indexTogether(...sets)` records multi-field index metadata from field-name sets. It fits cases where several fields should be indexed together as a group.

`merge(...fragments)` composes several fragments into one reusable block. It fits model definitions that should inherit several pieces of metadata from one place.

## `Constraints` and `c`

`Constraints`, also exported as `c`, builds table-level constraint definitions. Reach for this surface when the database rule lives at the table level and cannot be expressed as a simple per-field decorator.

```ts
const PostModel = Model({
    namespace: 'blog',
    name: 'Post',
    schema: PostSchema,
    constraints: [
        c.unique(['slug'], { name: 'posts_slug_unique' }),
        c.check(\"status in ('draft', 'published')\", { name: 'posts_status_check' }),
    ],
});
```

`unique(fields, options?)` declares a table-level uniqueness constraint. Use it when uniqueness belongs to one or more fields considered together.

`check(condition, options?)` declares a check constraint. Use it when the database should enforce a boolean condition on the row.

`exclusion(definition)` declares an exclusion constraint definition. Use it when the database backend supports exclusion constraints and you need to pass the full exclusion definition object directly.

## `Indexes` and `i`

`Indexes`, also exported as `i`, builds explicit table-level index definitions.

`index(on, options?)` declares an index over one or more fields in one place. It fits indexes that belong at the model level rather than as simple field-level `dbIndex(...)` annotations.

```ts
const PostModel = Model({
    namespace: 'blog',
    name: 'Post',
    schema: PostSchema,
    indexes: [
        i.index(['publishedAt', 'id'], { where: 'published_at is not null' }),
    ],
});
```

## `ModelRegistry`

`ModelRegistry` resolves models by their `namespace/name` key. Most application code uses the shared registry that `Model(...)` writes to automatically. Separate registry instances are mainly useful in tests and tooling that need an isolated set of models.

```ts
const registry = new ModelRegistry();
registry.register(PostModel);

const sameModel = registry.get('blog', 'Post');
const resolved = registry.resolveRef('blog/Post');
```

`ModelRegistry.global()` returns the shared process-wide registry used by `Model(...)`.

`ModelRegistry.register(model)` and `ModelRegistry.registerMany(models)` add models to that shared registry.

`ModelRegistry.get(namespace, name)` and `ModelRegistry.getByKey(key)` look up models from the shared registry.

`ModelRegistry.resolveRef(ref)` resolves any supported model-reference form against the shared registry. It accepts a model key string such as `blog/Post`, a direct model object, or a callback that returns a model.

`ModelRegistry.clear()` clears the shared registry. That is mainly useful in tests.

A dedicated registry instance exposes the same registration and lookup operations on that instance instead of the shared one. `values()` returns the registered models in insertion order.

## `registerModelAugmentor(...)`

`registerModelAugmentor(...)` is an extension surface for framework code and tooling. It lets framework-level code add behavior or metadata to declared models without rewriting every `Model(...)` call site.

When you register an augmentor, Tango runs it immediately against the models that are already present in the shared registry, and then again for every model declared afterward. The function returns a cleanup callback you can call to remove the augmentor.

Application code rarely needs this directly. Reach for it when you are building framework-level extensions around Tango's model contract.

## Main exported types

The package also exports types for code that wants to name the schema contract explicitly.

`ModelDefinition` is the main type for code that wraps or generates `Model(...)` definitions.

`Field`, `FieldType`, `RelationDef`, `RelationType`, `IndexDef`, and `ModelMetadata` are the types most often needed when code inspects model metadata directly.

`ModelWriteHooks`, `ModelHookModel`, `ModelWriteHookManager`, and the hook argument types such as `BeforeCreateHookArgs` and `AfterUpdateHookArgs` are the types most often needed when code builds hook-aware helpers or extension points around model writes.

## Related pages

- [Models and schema](/topics/models-and-schema)
- [How to work with models](/how-to/work-with-models)
- [Migrations](/topics/migrations)
