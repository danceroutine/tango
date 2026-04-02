# Models and schema

Tango models start with Zod schemas and add persistence metadata on top. This is the foundation the rest of the framework builds on.

If you have used Django models and Django REST Framework serializers, the idea is familiar: one definition should carry as much truth as possible, and the rest of the stack should derive behavior from it.

## What `Model(...)` creates

`Model(...)` takes a definition object and returns two things:

- `schema`, which is the Zod object you validate against
- `metadata`, which contains table name, field definitions, indexes, relations, ordering, and other database-facing information

`Model(...)` behaves like this:

- `namespace` is required
- `name` is required
- `table` is optional
- when `table` is omitted, Tango derives it from `name` by converting to snake case and pluralizing it
- the model is registered in the global `ModelRegistry`

That means `Post` becomes `posts`, and `BlogPost` becomes `blog_posts` unless you override the table explicitly.

## A typical model

The blog example defines `PostModel` like this:

```ts
export const PostModel = Model({
    namespace: 'blog',
    name: 'Post',
    schema: PostReadSchema.extend({
        id: t.primaryKey(z.number().int()),
        authorId: t.foreignKey('blog/User', z.number().int(), {
            onDelete: 'CASCADE',
            onUpdate: 'CASCADE',
        }),
        published: t.default(z.coerce.boolean(), 'false'),
        createdAt: t.default(z.string(), { now: true }),
        updatedAt: t.default(z.string(), { now: true }),
    }),
});
```

This one definition gives several later layers the information they need:

- validation shape for reading data
- primary key metadata
- foreign key metadata
- default values used by migration generation and schema diffing

## Why Tango uses Zod here

Zod gives Tango two important things:

- a runtime validator you can use directly in request and query code
- a clear TypeScript type boundary through `z.input` and `z.output`

That keeps the model definition close to application code instead of hiding it behind a separate schema language.

## Explicit metadata and inferred metadata

Tango can infer field information from the Zod schema, but explicit metadata wins.

The implementation in `Model.ts` does this:

1. use `definition.fields` if you provided it
2. otherwise infer fields from the Zod schema with `inferFieldsFromSchema`

This is why field decorators such as `t.primaryKey(...)` and `t.foreignKey(...)` matter. They attach metadata the inference step can read.

## Identity and namespacing

Every model receives a key in the form `namespace/name`, and that key becomes the stable identity Tango uses when it resolves relations.

That is how Tango resolves model references across packages and relations. In practice it means:

- keep `namespace` stable
- keep `name` stable
- treat changes to either one as schema and migration changes, not cosmetic refactors

## Registry and relation resolution

`ModelRegistry` is the central lookup mechanism for model references, especially when relation metadata needs to resolve a target model by name.

Most application code uses the registry indirectly through model definitions and relation metadata. Models are registered as they are defined, so relation resolution can happen later without extra setup in application code.

## Schema design advice

Use separate schemas for distinct responsibilities:

- a read schema for data returned from the database or API
- a create schema for incoming POST bodies
- an update schema for partial updates

The examples follow this pattern:

- `PostReadSchema`
- `PostCreateSchema`
- `PostUpdateSchema`

That separation keeps validation clear and avoids turning one schema into a long list of conditionals.

## What belongs here and what belongs elsewhere

Put these concerns in the model layer:

- field shape
- field metadata
- table name
- indexes
- relations
- default ordering metadata

Keep the following concerns out of the model layer and place them in the resource or query layer instead:

- request parsing
- HTTP status codes
- pagination rules
- business workflows that require database access

Those concerns fit better in the resource or query layer, where request handling and database behavior are already being coordinated.

## Related pages

- [Schema API reference](/reference/schema-api)
- [Migrations](/topics/migrations)
- [Blog API tutorial](/tutorials/express-blog-api)
