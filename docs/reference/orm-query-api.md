# ORM query API reference

`@danceroutine/tango-orm` provides the runtime, manager, query, and adapter contracts that make up Tango's persistence layer.

## Top-level exports

The root export includes:

- namespace barrels `runtime`, `manager`, `connection`, `query`, and `transaction`
- `AdapterRegistry`, `connectDB`, and `getDefaultAdapterRegistry`
- `PostgresAdapter` and `SqliteAdapter`
- `ModelManager`
- `QuerySet`, `Q`, `QBuilder`, and `QueryCompiler`
- query domain types such as `CompiledQuery`, `Direction`, `FilterInput`, `OrderToken`, `QueryExecutor`, `QuerySetState`, and `TableMeta`
- `UnitOfWork`

## `Model.objects`

`Model.objects` is the default application-facing query surface.

The manager gives application code:

- `query()`
- `findById(id)`
- `getOrThrow(id)`
- `create(input)`
- `update(id, patch)`
- `delete(id)`
- `bulkCreate(inputs)`

It resolves through Tango's runtime-owned DB client lifecycle, so application code does not need an explicit runtime initialization step for the common path.

## `QuerySet<T>`

`QuerySet<T>` is the immutable query builder used by model managers and resource classes.

### Query composition methods

- `filter(q)`
- `exclude(q)`
- `orderBy(...tokens)`
- `limit(n)`
- `offset(n)`
- `select(cols)`
- `selectRelated(...rels)`
- `prefetchRelated(...rels)`

### Execution methods

- `fetch(shape?)`
- `fetchOne(shape?)`
- `count()`
- `exists()`

### Notes

- each method returns a new `QuerySet`
- `fetch()` returns `{ results, nextCursor }`
- `count()` wraps the compiled SQL in a subquery and runs `COUNT(*)`

## `Q`

`Q` is the boolean expression builder for nested filter logic.

Methods:

- `Q.and(...)`
- `Q.or(...)`
- `Q.not(...)`

Use it when nested boolean logic is clearer than chaining plain object filters.

## Database adapters

The built-in adapters are:

- `SqliteAdapter`
- `PostgresAdapter`

They create `DBClient` implementations that model managers and migration tooling can all use.

## Related pages

- [ORM and QuerySets](/topics/orm-and-querysets)
- [Build your API with viewsets](/how-to/build-your-api-with-viewsets)
- [Pagination](/how-to/pagination)
