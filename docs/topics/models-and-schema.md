# Models and schema

A Tango model is the central description of one kind of stored record. It starts with a Zod schema, then adds the database-facing metadata that Tango needs in order to create queries, generate migrations, resolve relations, and build higher-level resource behavior.

In Tango, the model contract is one of the main places where application code declares what data exists, how that data relates to other records, and which parts of the schema the rest of the framework may rely on.

The basics:

- a model is created with `Model(...)`
- a model has a stable identity through `namespace` and `name`
- a model's `schema` is a Zod object
- field helpers such as `t.primaryKey(...)`, `t.foreignKey(...)`, and `t.field(...)` attach persistence metadata to that schema
- Tango registers the model so that relations, queries, migrations, and resources can refer to it later

## A quick example

This example defines a blog post model. It assumes the application also exports a `UserModel` whose stable model key is `blog/User`.

```ts
import { Model, t } from '@danceroutine/tango-schema';
import { z } from 'zod';

export const PostSchema = z.object({
    id: t.primaryKey(z.number().int()),
    authorId: t.foreignKey(t.modelRef<typeof import('./UserModel').UserModel>('blog/User'), {
        // Stored foreign-key value on the Post record.
        field: z.number().int(),
        // Forward relation exposed as Post.author.
        name: 'author',
        // Reverse relation exposed as User.posts.
        relatedName: 'posts',
        // Database referential actions used by migrations and constraints.
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE',
    }),
    title: z.string(),
    slug: z.string(),
    content: z.string(),
    published: t.field(z.coerce.boolean()).defaultValue('false').build(),
    createdAt: t.field(z.string()).defaultValue({ now: true }).build(),
    updatedAt: t.field(z.string()).defaultValue({ now: true }).build(),
});

export const PostModel = Model({
    namespace: 'blog',
    name: 'Post',
    schema: PostSchema,
});
```

From that one definition, Tango can learn the model's identity, stored record shape, primary key, relation metadata, and defaults. Other Tango layers can then derive behavior from the same model definition without asking application code to restate those details in several places.

## What `Model(...)` creates

`Model(...)` does two jobs at once.

First, it preserves the Zod schema you wrote. Application code can still use that schema as a normal validation surface, and the rest of the framework can still reason about the model through Zod's input and output types.

Second, it builds the model metadata that Tango's persistence-oriented layers need. That metadata includes the model identity, the table name, the field list, relation information, defaults, indexes, and ordering hints.

For application code, the model becomes the place where Tango learns what kind of record this is, where to store it, and how to look for it.

## Model identity and table names

Every model has a stable identity in the form `namespace/name`.

Django can use the application module as part of a model's identity, so examples such as `core.User` and `posts.Post` inherit a namespace from the Django app that owns the model. Tango runs inside host frameworks with different project layouts and cannot rely on one app-module structure. Each model therefore declares its own `namespace` and `name`.

That identity lets Tango deterministically resolve to the correct model when one model needs to refer to another. In the example above, `authorId` points at `blog/User` through `t.modelRef<typeof import('./UserModel').UserModel>(...)`. The string key keeps runtime relation metadata stable when the application grows across several files or packages, while the generic target model gives TypeScript enough information to type relation hydration.

The model also has a table name. If you do not set `table` explicitly, Tango derives one from `name` by converting it to snake case and pluralizing it. `Post` becomes `posts`, and `BlogPost` becomes `blog_posts`.

Most applications can rely on that default naming convention. Set `table` explicitly when the database needs a specific table name and you want the model contract to reflect that choice directly.

## Fields and persistence metadata

The most important part of a model is the set of fields it declares.

Some fields only need their Zod shape. A `title` or `content` field may only need to say "this value is a string." Other fields carry persistence meaning that the database and the migration system need to understand. That is why Tango provides helpers such as:

- `t.primaryKey(...)` for the primary key
- `t.foreignKey(...)` for relations stored through foreign-key columns
- `t.field(...).defaultValue(...).build()` for values that should exist by default at persistence time

These helpers extend the capabilities offered by Zod to inject database-facing metadata.

## Relations

When you declare a relationship in a Tango model, you are describing part of the stored record contract. The relationship tells Tango which records may point at one another, how that link should be represented in SQL, and which connections the ORM can safely reason about later. A blog post belongs to one author. A user may have one profile. A tagging system may connect one post to many tags and one tag to many posts. Those relationships belong in the model because they change the shape of the stored data.

A foreign key begins with a field that stores the reference itself. In the blog example, `authorId: t.foreignKey(t.modelRef<typeof import('./UserModel').UserModel>('blog/User'), { field: z.number().int() })` says that the field is an integer and that the integer points at the `blog/User` model. When Tango prepares that model for database and query work, it resolves the stable model identity into concrete metadata such as the target table, the referenced column, and any delete or update behavior configured through `onDelete` or `onUpdate`. The migration system can then emit a real foreign-key constraint, and the database can enforce that every `authorId` points at a row that actually exists.

A one-to-one relationship follows the same path, but with one extra guarantee. `t.oneToOne(...)` still resolves to a database reference, and it also marks the column as unique. At the SQL level, that combination means each row may point at one parent row, and no two rows may point at the same parent through that column. This is the usual fit for data such as a user profile, where the relationship should behave like an extension of the main record instead of a repeating child table.

Many-to-many relationships need a different shape, because a SQL database cannot represent them with one foreign-key column on one table. Tango lets you declare a many-to-many relationship in model schema metadata with `t.manyToMany(...)`, which records the target model and keeps the relationship visible in the model contract. In a relational database, the actual implementation still needs a join table. Today, the normal Tango pattern is to model that join table explicitly, for example with a `PostTag` model that stores `postId` and `tagId` as foreign keys. That gives migrations a concrete table to create, gives the database concrete constraints to enforce, and gives the ORM a concrete relation graph to query.

The ORM capabilities build on those declarations. Field helpers such as `t.foreignKey(...)` and `t.oneToOne(...)` describe how the relation is stored and can publish relation names through `name` and `relatedName`. Model-level `relations: (r) => ...` metadata remains available for compatibility and ambiguity resolution, but straightforward storage-backed relations can now stay on the field that owns the reference. Once the relation graph is resolved, query code can follow declared relations instead of re-deriving join logic from raw table names and column pairs in each query.

For example, once `PostModel` declares that `authorId` belongs to `blog/User`, ORM code can ask for posts together with their authors through the relation name rather than through hand-written join details:

```ts
export const PostModel = Model({
    namespace: 'blog',
    name: 'Post',
    schema: PostSchema,
});

const recentPosts = await PostModel.objects
    .query()
    .filter({ published: true })
    .selectRelated('author')
    .orderBy('-createdAt')
    .fetch();

recentPosts.results[0].author?.email;
```

`selectRelated('author')` follows the resolved relation metadata, loads the related `UserModel`, and attaches it as `author`. Reverse collection relations use `prefetchRelated(...)`; for example, `UserModel.objects.query().prefetchRelated<typeof PostModel>('posts')` loads each user's `PostModel` records as `posts`.

::: warning
Relation hydration covers direct relations. Nested traversal such as `author__profile` remains future query work.
:::

Relation changes therefore affect several layers at once. Changing a relation changes the schema that migrations apply, the constraints that the database enforces, and the paths that ORM queries can use when they walk from one model to another.

## Zod and the model contract

Zod is a TypeScript-first schema and validation library. It lets you describe the shape of data with executable declarative schemas that can validate values at runtime while also giving TypeScript precise static types. In normal application code, developers often reach for Zod to describe request payloads, configuration objects, or domain data that needs both validation and inference.

Using Zod this way gives application code a few immediate benefits. One schema can serve as both the validation contract and the source of inferred types. Schema composition stays ergonomic because Zod supports operations such as `extend(...)`, `pick(...)`, `omit(...)`, and `partial()`. A change to the data shape stays visible in one place instead of being copied into separate runtime validators and TypeScript interfaces.

Those benefits map naturally onto Tango's model layer. A stored record already needs a data shape, and application developers are already comfortable describing data shapes in Zod. Tango therefore begins with ordinary Zod schemas for the parts of the model that are really about data shape, such as strings, numbers, booleans, dates, objects, and arrays. That keeps model definitions readable to anyone who already understands Zod, and it keeps Tango aligned with a tool that many TypeScript teams already use elsewhere in the application.

However, a persistence layer needs additional information beyond data shape. It needs to know which field is the primary key, which column points at another table, which default should be treated as a persistence concern, which table name belongs to the model, and which hooks should run when a record is created or updated. It also needs a stable way for one model to refer to another model without hard-coding database details all over the application.

Tango adds those missing capabilities on top of Zod. Field helpers such as `t.primaryKey(...)`, `t.foreignKey(...)`, `t.oneToOne(...)`, and `t.field(...)` enrich Zod fields with persistence metadata. `Model(...)` wraps the schema with model-level metadata such as the namespace, model name, table name, relations, and lifecycle hooks. Tango also keeps stable model identities such as `blog/User`, so migrations and the ORM can resolve those references into the table and relation metadata they need later.

This structure also supports dry model and serializer work. A team can define shared Zod fragments for a blog post once, derive `PostCreateSchema` and `PostUpdateSchema` from those fragments for serializer use, and derive the stored record schema for `Model(...)` from the same family of Zod definitions. The model still carries database-specific metadata that serializers do not need, and serializers still remain free to shape request and response contracts differently, but the underlying field vocabulary can be shared instead of rewritten by hand in each layer.

## Related pages

- [Work with models](/how-to/work-with-models)
- [Migrations](/topics/migrations)
- [ORM and QuerySets](/topics/orm-and-querysets)
- [Schema API](/reference/schema-api)
