# Schema API

`@danceroutine/tango-schema` is the package that declares Tango models. It gives application code one place to describe record shape, database metadata, relations, and model-owned write hooks. The ORM, migrations, resources, and OpenAPI layers all build on that model contract.

Most application code imports the schema surface from the package root:

```ts
import { Model, ModelRegistry, c, i, m, t } from '@danceroutine/tango-schema';
import { z } from 'zod';
```

`Model(...)` is the entrypoint most application code starts with. The remaining exports support field metadata, reusable model metadata, explicit indexes and constraints, model lookup, and framework-level extension work.

## `Model(...)`

`Model(...)` creates a Tango model from a Zod object schema and a model definition object. The returned model carries the Zod schema, the derived metadata Tango needs later, and any write hooks you declared. Tango registers the model on a `ModelRegistry` before returning it so the rest of the framework can resolve it by key.

```ts
const PostModel = Model({
    namespace: 'blog',
    name: 'Post',
    schema: z.object({
        id: t.primaryKey(z.number().int()),
        title: z.string(),
        slug: t.unique(z.string()),
        authorId: t.foreignKey('blog/User', {
            field: z.number().int(),
            name: 'author',
            relatedName: 'posts',
        }),
    }),
    ordering: ['-id'],
});
```

### Identity and schema

`namespace` and `name` are required. Together they form the model key, such as `blog/Post`, which is how registries and relation metadata refer to the model later. They also provide the default basis for derived names such as the table name.

`schema` is also required. It must be a Zod object schema. Tango keeps that schema on the model and uses it as the source of truth for field inference when you do not provide explicit `fields`.

### Table and field metadata

`table` lets you override Tango's default table-name derivation. Leave it out when the derived plural snake-case table name is good enough. Set it when the database table name must be fixed explicitly.

`fields` lets you provide explicit `Field[]` metadata instead of relying on inference from the Zod schema and field decorators. Most application code can omit it. Reach for it when Tango's generated field metadata is not the shape you want migrations, schema diffing, or similar tooling to consume.

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

This explicit form gives you direct control over the `Field` metadata that Tango publishes to field-oriented tooling. Field decorators define foreign-key semantics and straightforward relation names; `relations` remains available for model-level relation overrides.

### Relations and model-level metadata

`relations` lets you declare named relations through `RelationBuilder`. It fits models that need relation names such as `author`, `comments`, or `profile` for other Tango layers to read later.

`t.foreignKey(...)` lives on the field that stores the foreign-key value, such as `authorId`, and records how that field points to another model. Prefer putting straightforward storage-backed relation names on the field decorator through `name` and `relatedName`.

`relations` is still supported for compatibility with the original relation architecture and for cases where naming needs to be centralized at the model level. Use it when a field-authored relation needs a model-level override or when several field-authored edges would otherwise compete for the same relation name.

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

When a write hook runs inside `transaction.atomic(...)`, its args also receive an optional `transaction` handle with one narrow capability: `transaction?.onCommit(...)`.

```ts
const UserModel = Model({
    namespace: 'blog',
    name: 'User',
    schema: z.object({
        id: t.primaryKey(z.number().int()),
        email: z.string().email(),
    }),
    hooks: {
        afterCreate({ record, transaction }) {
            transaction?.onCommit(() => {
                invalidateUserCache(record.id);
            });
        },
    },
});
```

Hook code only needs a callback registrar, so the hook args expose that narrow `onCommit(...)` contract and nothing broader. Outside an active `atomic(...)` block, the `transaction` field is `undefined`.

## `RelationBuilder`

Use `RelationBuilder` inside `relations: (builder) => ({ ... })` when your model needs named relation metadata at the model level. This is the place to describe how one model points at another in application-facing terms, such as `author`, `comments`, or `profile`.

```ts
const PostModel = Model({
    namespace: 'blog',
    name: 'Post',
    schema: z.object({
        id: t.primaryKey(z.number().int()),
        authorId: t.foreignKey('blog/User', { field: z.number().int() }),
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

This example assumes `UserModel` is imported from the model module that owns the `blog/User` model key.

```ts
const PostSchema = z.object({
    id: t.primaryKey(z.number().int()),
    slug: t.unique(z.string()),
    author: t.foreignKey(t.modelRef<typeof UserModel>('blog/User'), {
        field: z.number().int(),
        name: 'author',
        relatedName: 'posts',
    }),
});
```

### Field identity and nullability helpers

`primaryKey(...)` marks a field as the model's primary key and records it as not-null. Use it on the field that identifies the row.

`unique(...)` marks a field as uniquely constrained. Use it when one column must not contain duplicate values.

`null(...)` marks a field as nullable in Tango's field metadata. Use it when the column should explicitly allow `NULL`.

`notNull(...)` marks a field as not-null in Tango's field metadata. Use it when the schema or storage contract should state that the column must be present.

These helpers can be used directly on a schema or, for the unary helpers, as decorator factories when that reads better in composed Zod code.

### Default, column, and indexing helpers

`field(schema)` starts a fluent builder for scalar field metadata. Use it when a field needs several metadata helpers and nested calls would obscure the schema:

```ts
const score = t
    .field(z.number())
    .defaultValue('0')
    .dbColumn('score_value')
    .choices([0, 1, 2])
    .helpText('Score between 0 and 2')
    .build();
```

`build()` returns the original Zod schema after applying the Tango metadata.

`defaultValue(value)` records an application-level default on the field contract. `value` is the default Tango should publish in metadata, such as a literal string, `null`, or `{ now: true }`. This is Tango metadata; use Zod's `.default(...)` when you want parse-time default behavior. The older `default(schema, value)` helper still works for compatibility.

`dbDefault(value)` records a database-side default expression. Use it when the database should provide the value rather than relying on application code to fill it in first. The older `dbDefault(schema, value)` helper still works for compatibility.

`dbColumn(name)` records an explicit database column name. Use it when the property name in application code should map to a different column name. The older `dbColumn(schema, name)` helper still works for compatibility.

`dbIndex()` records field-level index metadata without a separate table-level index definition. The older `dbIndex(schema)` helper still works for compatibility.

### Choice, validation, and display helpers

`choices(values)` records an allowed choice set on the field metadata. `values` is the list of allowed choices that higher-level consumers may inspect. The older `choices(schema, values)` helper still works for compatibility.

`validators(...values)` records additional validator functions on the field metadata. `values` is the list of field-aware validation functions Tango should publish. The older `validators(schema, ...values)` helper still works for compatibility.

`helpText(text)` records human-readable explanatory text on the field metadata. The older `helpText(schema, text)` helper still works for compatibility.

`errorMessages(map)` records custom error messages on the field metadata. `map` stores message overrides that higher-level tooling can inspect. The older `errorMessages(schema, map)` helper still works for compatibility.

### Relation field helpers

Relation helpers attach model-relationship metadata to the field that stores or represents the relation. They let the model schema describe the stored reference, the target model, and the relation names that querysets can hydrate later.

#### `modelRef<TModel>(key)`

Use `modelRef<TModel>(key)` when a relation should keep the runtime decoupling of a string model key while still giving TypeScript the target model type.

```ts
const authorTarget = t.modelRef<typeof UserModel>('blog/User');
```

At runtime, Tango resolves `blog/User` through the model registry. At type-check time, the generic carries `typeof UserModel`, which lets querysets infer hydrated relation shapes from string-key references. Generated relation typing is now the supported path for reverse and nested relation names, so most application code no longer needs explicit target-model generics once the app-local registry is current. A plain string key still works for runtime relation resolution when application code does not need strict hydrated relation typing.

#### `foreignKey(target, config?)`

Use `foreignKey(target, config?)` when the current model stores a reference to one record on another model. A blog post author is the usual example: the post stores a value such as `authorId`, and that value points at the user model.

```ts
const PostSchema = z.object({
    id: t.primaryKey(z.number().int()),
    authorId: t.foreignKey(t.modelRef<typeof UserModel>('blog/User'), {
        field: z.number().int(),
        name: 'author',
        relatedName: 'posts',
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE',
    }),
});
```

The config object controls the relation contract:

- `field` supplies the Zod schema for the stored reference value. If it is omitted, Tango uses `z.number().int()`.
- `column` names the target model field when the relation should point at something other than the target model's primary key.
- `onDelete` and `onUpdate` record referential actions for migration and schema tooling.
- `name` publishes the forward relation name, such as `Post.author`.
- `relatedName` publishes the reverse relation name, such as `User.posts`.

When Tango turns that model metadata into database schema, the relation is equivalent to a foreign-key constraint from the source field to the target model:

```sql
ALTER TABLE posts
ADD CONSTRAINT posts_author_id_fkey
FOREIGN KEY (authorId) REFERENCES users(id)
ON DELETE CASCADE
ON UPDATE CASCADE;
```

The field key and relation name can be the same when you want Django-style relation access:

```ts
const PostSchema = z.object({
    author: t.foreignKey(t.modelRef<typeof UserModel>('blog/User'), {
        name: 'author',
        relatedName: 'posts',
    }),
});
```

An unhydrated result exposes `author` as the stored reference value. A queryset that calls `selectRelated('author')` exposes `author` as the hydrated user model or `null`, and nested traversal can continue from there through paths such as `author__profile`.

#### `oneToOne(target, config?)`

Use `oneToOne(target, config?)` when the current model points at one target record and no other record should point at that same target through this field. A user profile is the common fit: one profile belongs to one user, and one user should have at most one profile.

```ts
const ProfileSchema = z.object({
    id: t.primaryKey(z.number().int()),
    userId: t.oneToOne(t.modelRef<typeof UserModel>('blog/User'), {
        field: z.number().int(),
        name: 'user',
        relatedName: 'profile',
    }),
});
```

`oneToOne(...)` accepts the same config options as `foreignKey(...)`: `field`, `column`, `onDelete`, `onUpdate`, `name`, and `relatedName`. In the ORM layer it creates a single-valued forward relation and a single-valued reverse relation. In the persistence layer, it behaves like a foreign key plus a uniqueness constraint on the source field:

```sql
ALTER TABLE profiles
ADD CONSTRAINT profiles_user_id_fkey
FOREIGN KEY (userId) REFERENCES users(id);

CREATE UNIQUE INDEX profiles_user_id_unique ON profiles(userId);
```

#### `manyToMany(target, config?)`

Use `manyToMany(target, config?)` when the model contract needs a collection-valued relation between two models. The field itself does not become a column on the owning table; instead, Tango records the relation in the [relation graph](/contributors/topics/resolved-relation-graph) and synchronizes migrations and ORM metadata through a join table.

When you omit `through`, `throughSourceFieldName`, and `throughTargetFieldName`, Tango synthesizes an internal-only join model registered on the same registry as your app models. That model picks up a deterministic physical table name derived from the owning model key, the Zod field key where `manyToMany` appears, and the target model key. Publishing a different relation `name` alone does not change that identity. Renaming the field key on the owning schema can change join-table identity; if you need a stable hand-managed layout or want to avoid collisions with existing tables, supply an explicit through model and full through metadata instead.

Self-referential many-to-many uses distinct through-side field names shaped like `fromPost` and `toPost`, mirroring Django’s implicit intermediary naming when both endpoints are the same model.

When you provide `through`, you must supply `through`, `throughSourceFieldName`, and `throughTargetFieldName` together so the relation graph can resolve physical columns on your join model.

```ts
const PostSchema = z.object({
    tagIds: t.manyToMany(t.modelRef<typeof TagModel>('blog/Tag'), {
        field: z.array(z.number().int()),
        name: 'tags',
    }),
});
```

The config object supports `field`, `name`, `through`, `throughSourceFieldName`, and `throughTargetFieldName`. `field` supplies the relation-facing Zod schema. If it is omitted, Tango uses `z.array(z.number().int())`. `name` publishes the forward relation name.

The forward many-to-many edge stays `migratable: false` on the owner model because there is still no owner-row column for the collection; DDL for the join rows is owned by the synthesized or explicit through model that appears in migration metadata.

Persisted records returned by the manager carry a related-manager accessor named after the published relation. For the example above, `post.tags.add(tag, featuredTag)`, `post.tags.remove(tag)`, `post.tags.set(featuredTag)`, and `post.tags.all()` insert, delete, replace, and read membership rows through the resolved through model. `add(...)`, `remove(...)`, and `set(...)` accept one or more targets, and duplicate `add(...)` calls are ignored. The accessor stays a manager even after `prefetchRelated('tags')`; eager loading only warms its cache. The accessor is documented in the [ORM query API reference](/reference/orm-query-api).

Reverse many-to-many naming, the bulk `set(...)` helper, the `clear()` helper, and `create(...)` on the related manager remain roadmap work.

The object form is the preferred public relation-decorator contract. The older positional schema overloads remain available for compatibility.

Unlike `RelationBuilder`, relation field helpers accept a plain model key string such as `blog/User`, a typed model reference from `t.modelRef(...)`, a direct model object, or a callback that returns a model.

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

`Constraints`, also exported as `c`, builds table-level constraint definitions. Reach for this surface when the database rule lives at the table level and cannot be expressed as a per-field decorator.

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

`index(on, options?)` declares an index over one or more fields in one place. It fits indexes that belong at the model level rather than as field-level `dbIndex(...)` annotations.

```ts
const PostModel = Model({
    namespace: 'blog',
    name: 'Post',
    schema: PostSchema,
    indexes: [i.index(['publishedAt', 'id'], { where: 'published_at is not null' })],
});
```

## `ModelRegistry`

`ModelRegistry` resolves models by their `namespace/name` key. Most application code uses the default shared registry that `Model(...)` writes to automatically. Separate registry instances are useful when you need an isolated model set.

```ts
const registry = new ModelRegistry();
registry.register(PostModel);

const sameModel = registry.get('blog', 'Post');
const resolved = registry.resolveRef('blog/Post');
```

`ModelRegistry.global()` returns the shared default registry used by `Model(...)` for the current `@danceroutine/tango-schema` package instance.

`ModelRegistry.active()` and `ModelRegistry.runWithRegistry(...)` handle the explicit construction path. That active binding is the part Tango shares across separate schema package copies, which lets maintainer tooling such as model loading and code generation bind one registry intentionally without turning the ambient default registry into process-wide state.

`ModelRegistry.register(model)` and `ModelRegistry.registerMany(models)` add models to that shared registry.

`ModelRegistry.get(namespace, name)` and `ModelRegistry.getByKey(key)` look up models from the shared registry.

`ModelRegistry.resolveRef(ref)` resolves any supported model-reference form against the shared registry. It accepts a model key string such as `blog/Post`, a typed model reference from `t.modelRef(...)`, a direct model object, or a callback that returns a model.

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
