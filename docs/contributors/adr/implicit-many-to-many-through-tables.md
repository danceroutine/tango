# 2026-04-17 Implicit Many-To-Many Through Tables

> Companion to [2026-04-09 Deep relation hydration with generated path typing](/contributors/adr/deep-relation-hydration-with-generated-path-typing), which scoped out many-to-many hydration for that milestone. Here we record how Tango represents and migrates implicit many-to-many join tables when authors omit `through`, and how schema registry, migrations, ORM, and generated relation typing stay aligned.

## Problem

Many-to-many in Tango today expects an explicit through model and fully specified through field names before the relation graph can resolve storage and hydration. Application authors familiar with Django expect `manyToMany(target)` to imply a join table with deterministic ownership and migration behavior for the common case, using an explicit through model only when they opt into one.

Shipping implicit join tables touches several layers at once:

1. Storage needs a real table with foreign keys and uniqueness appropriate for the pair edge. Implicit joins use the same graph finalization and storage artifacts pathway as explicit through models for the join table and its fields.
2. Migrations need the same registry-backed model set the runtime treats as authoritative, including synthesized join tables, `managed` semantics respected, and alignment logic that leaves unmanaged or unmodeled tables intact.
3. Apply order on an empty database must succeed when endpoint tables reference each other and when join tables reference endpoints—cases where inline foreign keys on `CREATE TABLE` force ordering constraints a single creation pass cannot always satisfy.
4. ORM reuses the through-table prefetch path and adds join-row writes with SQL safety grounded in resolved physical column types for join keys.
5. Codegen keeps relation typing derived from the same resolved relation graph snapshot as runtime; hydratable edges continue to resolve `targetModelKey` values that appear in `modelTypeAccessors` for exported models.

## Considered Option: Storage-Only Join Metadata Outside `Model`

Represent implicit joins only as derived metadata in the relation graph or migrations layer, without registering a `Model` for the join table.

### Pros

- Avoids registering internal models in `ModelRegistry`.
- Smaller conceptual surface in schema authoring.

### Cons

- Duplicates the explicit-through code path in `ResolvedRelationGraphBuilder` and storage finalization, or forks behavior for implicit versus explicit joins.
- Harder to reuse `inferFieldsFromSchema`, normalized relations on the through side, and the same migration projection pipeline used for ordinary models.

## Considered Option: Inline Foreign Keys Only And Global Table Creation Ordering

Emit `CREATE TABLE` with inline foreign keys and require a single topological sort over all tables so every reference points to an already-created table.

### Pros

- Matches how `diffSchema` currently builds table-create operations with `ColumnSpec.references` embedded in `TABLE_CREATE`.
- Minimal change when the dependency graph is a DAG with a feasible creation order.

### Cons

- Mutual foreign keys between endpoint tables break a naive “one ordering fits all” story unless models are split across migrations or fields are temporarily nullable.
- Implicit through tables still need to come after their endpoints; the ordering problem spans both endpoints and joins.

## Considered Option: Ad-Hoc Per-Dialect Ordering In The CLI

Encode special cases in `make:migrations` or the migration runner whenever SQLite or Postgres disagrees about constraint timing.

### Pros

- Fast local fixes.

### Cons

- Ordering rules become hard to audit and duplicate across compile, plan, and apply paths.
- Contributors cannot treat database construction as a single explicit contract.

## Decision: Registered Through Models, Canonical DDL Passes, And Registry-Backed Migration Projection

### Representation

Schema and graph work already have a single, well-defined path from field decorators through normalized descriptors to `ResolvedRelationGraphBuilder`, but it only reaches a fully populated many-to-many edge when through metadata exists. The decision is to close that gap by materializing implicit joins as first-class schema objects rather than as a parallel “implicit-only” metadata channel.

Tango will synthesize internal-only `Model` values for each implicit join table and register them on the same `ModelRegistry` as author-defined models. Through that hook, field inference, relation normalization, and finalized storage artifacts will treat the join table like any other model. `ResolvedRelationGraphBuilder` will resolve many-to-many using one code path—the path that already expects a through model, through field keys, and physical column names—so `throughModelKey`, `throughTable`, through-side field names, and resolved through keys will stay aligned between the graph snapshot and what the ORM compiles.

Physical table and column identity for an implicit join will anchor on stable authoring inputs: `sourceModelKey`, `targetModelKey`, and the Zod object key on the owner where `t.manyToMany(...)` lives. The published relation `name` option alone will not pin storage identity, which protects physical names from accidental churn when authors rename the public relation label. Renaming the underlying Zod field key will remain a breaking change for implicit join identity until the schema layer gains an explicit stable id or table override comparable to opting into an explicit through model with a fixed `dbTable`.

The many-to-many edge on the owner model will stay `migratable: false` because there will still be no owner-row column for the collection; migration work for the relationship will live on the synthesized through model, which will own the join table DDL, default to `managed: true` in the schema sense, and appear in the same metadata projection that drives `diffSchema`. Readers of the graph will see both facts at once: the edge will describe navigation, the through model will describe persistence.

Self-referential many-to-many will follow Django’s implicit intermediary rule: when both endpoints are the same model, the join table will need two foreign keys to the same table, so Tango will disambiguate with distinct schema field names such as `fromPost` and `toPost`. That keeps the join-table schema valid SQL while preserving the same conceptual owner/target split Django uses for its implicit intermediary tables.

When two implicit configurations would resolve to the same triple of identity inputs, registry finalization will fail fast instead of producing two divergent physical layouts, trading a sharp authoring-time error for silent data routing bugs later.

### Brownfield and collisions

Implicit synthesis will assume Tango may introduce a new managed join table under deterministic naming rules. That assumption will break when the database already contains a manually created join table, or when the computed physical name collides with another table and suffixing cannot resolve the collision without guessing intent. In those situations the safe contract will be to stop with an error that tells the developer to model the existing table with an explicit `through` model and wire field names explicitly. Tango will not infer ownership over unknown legacy tables or rewrite them into implicit synthesis, because doing so would risk pointing the ORM at the wrong heap or silently leaving legacy data disconnected from new relation APIs.

### Migrations and `managed`

Migrations compare introspected database state to a desired model set. Two gaps in that story motivated explicit `managed` handling for this ADR. First, authors sometimes mark models `managed: false` to exclude tables that are owned elsewhere; alignment logic must treat those tables as outside create, alter, and drop operations so migrations do not fight external DDL. Second, when alignment would otherwise drop “extra” tables present in the database but absent from the managed projection, the diff must refrain from destructive drops so unmanaged or unmodeled tables survive schema sync.

The migration-layer `ModelMetadataLike` shape (the input to `diffSchema`) therefore gains `managed` semantics aligned with [`ModelMetadata`](/reference/schema-api): unmanaged entries do not generate mutating operations against their tables or columns, and extra database tables without a corresponding managed model in the projection are not dropped by alignment diffs.

Separately, `make:migrations` today can narrow the model list to whatever the exported models module surfaces through `collectExportedModels`. That view omits synthesized through models that exist only on the registry. The CLI instead builds an authoritative projection—conceptually `buildMigrationModelMetadataProjection(registry)`—that merges exported author models with synthesized through models from the same registry instance the loader constructed. Impact: generated migrations and runtime truth stay one registry snapshot; developers do not hand-maintain exports for join tables Tango synthesizes.

### DDL apply as sequenced passes

Persistence-layer construction is where inline foreign keys on `CREATE TABLE` interact badly with mutual references: if every constraint must exist at table creation time, some graphs have no valid linear table order. The implementation will treat database bring-up as an ordered pass schedule—tables and columns first, then attach constraints that reference already existing heaps, then secondary indexes—so the ordering contract lives in one place and dialect code translates each pass into legal SQL.

Within the tables pass, creation order among tables will use a topological sort over projected foreign-key references whenever columns exist before deferred constraints attach (that ordering will be implemented in `packages/migrations`, alongside the migration metadata projection and the DDL pass scheduler that sequences tables-phase work before SQL compilation—exact modules are spelled out in the milestone implementation plan). Dialect adapters will sit at the boundary between that abstract schedule and concrete statements: Postgres will typically add foreign keys with `ALTER TABLE … ADD CONSTRAINT`; SQLite may require different sequencing or capabilities for the same logical move. The pass graph will stay stable across dialects; adapters will own engine-specific rewriting.

The migration domain model already exposes `FK_CREATE`, `FK_VALIDATE`, `INDEX_CREATE`, and related `MigrationOperation` variants. The apply pipeline will group or sort operations into passes before compilation. Integration tests will cover phase boundaries, including graphs where endpoint tables reference each other, so foreign keys will attach in the constraints pass after the referenced tables exist from the tables pass. Contributors will get auditable ordering and fewer one-off “fix SQLite here, Postgres there” branches; users will get migrations that apply on empty databases without relying on accidental creation order.

### ORM and SQL safety

Many-to-many hydration at the ORM layer already compiles as a through-table query followed by target fetches, and that pipeline will stay in place while this milestone wires in accurate through metadata for implicit joins as soon as the resolved graph exposes through keys and table names. The larger change sits in SQL safety: prefetch validation will stop relying on shortcuts that treat through-key columns as if they always matched integer primary keys—a pattern that works until endpoints use UUID, text, or other non-integer keys. Instead, `OrmSqlSafetyAdapter.validate` for many-to-many prefetch will read resolved physical column types from the through table so compiled plans stay inside the same safety envelope as ordinary selects and mutations.

Join-row writes will follow the same mutation compiler and SQL safety stack as inserts and deletes on explicit models, which keeps validation, parameter binding, and future hooks consistent with the rest of `Model.objects`. Migrations define the uniqueness contract for `(owner, target)` pairs on the join table, and the ORM layer pairs that constraint with duplicate-safe link inserts so repeated `add(...)` calls remain idempotent even when two sessions race to create the same membership. Multi-target link operations run inside one transaction boundary so concurrent readers do not observe half-applied membership. Taken together, application code gets familiar Django-style many-to-many link semantics while maintainers retain one write path to audit.

### Codegen

TypeScript relation registries are a compile-time mirror of the same resolved relation graph snapshot the runtime consults when it builds `RelationMeta`. The generator (`generateRelationRegistryArtifacts`) walks hydratable edges and asks, for each `targetModelKey`, how to surface the target type: that answer still comes exclusively from `modelTypeAccessors`, the map from model key to exported type that the application’s models module supplies to codegen. The tension is that synthesized through models will usually exist only on the registry, not as named exports from the app module, so they will not automatically acquire accessor entries; a hydratable edge whose sole target were a synthetic key would either fail the generator or force placeholder types.

The milestone will resolve that by constraining how implicit many-to-many shows up in the typing story: hydratable forward many-to-many edges on owner models will continue to target exported endpoint models—the same keys that already appear in `modelTypeAccessors`—while any hydratable edges that originate on internal through models and need to participate in codegen will still point `targetModelKey` at those exported endpoints rather than at the synthetic through identity. That way the generated ambient registry and the runtime graph remain two filtered views of one registry snapshot without listing every internal model key in `modelTypeAccessors`.
