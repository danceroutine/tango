# Foreign Keys, Many-to-Many, and the Relation Seam

Tango has strived from day one to support foreign-key-style model declarations, named relations, and the beginnings of many-to-many declaration syntax. Earlier versions of Tango stored the meaning of those declarations in separate storage and relation layers after model construction.

This topic explains the boundary between those two layers. In Tango, that boundary is the relation seam: the point where field-oriented storage metadata and named relation semantics diverge and later need to be reconciled.

## What Tango already supported

Before the seam refactor, Tango already supported two important relation surfaces.

Conceptually, the old architecture looked like this:

<MermaidDiagram
    diagram-id="old-relation-architecture-erd"
    semantic-palette="relation-seam"
    :chart='[
        "flowchart TD",
        "    MODEL_DECLARATION[\"<b>Model Declaration</b>\n<code>Model(...)</code>\"] -->|contains| FIELD_DECORATOR[\"<b>Field Decorator</b>\n<code>t.foreignKey(...)</code>\"]",
        "    MODEL_DECLARATION -->|may define| RELATIONS_DECLARATION[\"<b>Relations Declaration</b>\n<code>relations: (r) =&gt; ...</code>\"]",
        "    FIELD_DECORATOR -->|feeds| STORAGE_METADATA[\"<b>Storage Metadata</b>\n<code>Field[]</code>\"]",
        "    FIELD_DECORATOR -->|captures| AUTHOR_INTENT[\"<b>Author Intent</b>\n<code>t.manyToMany(...)</code>\"]",
        "    RELATIONS_DECLARATION -->|feeds| NAMED_RELATION_SURFACE[\"<b>Named Relation Surface</b>\n<code>metadata.relations</code>\"]",
        "    STORAGE_METADATA -->|drives| MIGRATION_MANAGER[\"<b>Migration Manager</b>\n<code>schema planning</code>\"]",
        "    STORAGE_METADATA -->|shapes| ORM_TABLE_META[\"<b>ORM Table Meta</b>\n<code>objects.meta.fields</code>\"]",
        "    NAMED_RELATION_SURFACE -->|names| ORM_RELATION_META[\"<b>ORM Relation Meta</b>\n<code>objects.meta.relations</code>\"]",
        "    ORM_TABLE_META -->|informs| ORM_MODEL_MANAGER[\"<b>ORM Model Manager</b>\n<code>Model.objects</code>\"]",
        "    ORM_RELATION_META -->|informs| ORM_MODEL_MANAGER",
        "    AUTHOR_INTENT -->|leaves| UNPLACED_M2M_INTENT[\"<b>Unplaced M2M Intent</b>\n<code>implicit join-table</code>\"]",
        "    class MODEL_DECLARATION,MIGRATION_MANAGER,ORM_MODEL_MANAGER appFacing",
        "    class FIELD_DECORATOR,RELATIONS_DECLARATION authoring",
        "    class STORAGE_METADATA,ORM_TABLE_META,ORM_RELATION_META,NAMED_RELATION_SURFACE,AUTHOR_INTENT artifact",
        "    class UNPLACED_M2M_INTENT unresolved"
    ].join("\n")'
/>

The same layer colors apply to both conceptual diagrams in this section:

<MermaidDiagram
    diagram-id="relation-seam-layer-legend"
    semantic-palette="relation-seam"
    :chart='[
        "flowchart LR",
        "    A[\"App-facing Surface\"]",
        "    B[\"Authoring API Actors\"]",
        "    C[\"Produced Artifact\"]",
        "    D[\"Unresolved Intent\"]",
        "    A --- B --- C --- D",
        "    class A appFacing",
        "    class B authoring",
        "    class C artifact",
        "    class D unresolved",
        "    linkStyle 0,1,2 stroke-width:0px,fill:none"
    ].join("\n")'
/>

Field decorators such as `t.foreignKey(...)` and `t.oneToOne(...)` let a model field carry database-oriented reference metadata. That metadata was enough to derive storage-facing information such as foreign-key constraints, uniqueness, and column references.

Model-level `relations: (r) => ...` declarations let contributors publish named relations such as `author`, `posts`, or `profile`. That gave higher layers a place to talk about relation names even when the underlying storage field had a different name such as `authorId`.

Tango also had early declaration syntax for many-to-many relationships through `t.manyToMany(...)`. That syntax captured useful author intent, but it lived in a system that was still built primarily around stored columns.

## The constraints those features lived under

Those features had to serve two different kinds of consumers.

Storage-facing consumers needed concrete column metadata. Migrations, schema diffing, and field-oriented code generation needed to know which columns exist, which one is the primary key, and which database constraints attach to those columns.

Relation-facing consumers needed named graph semantics. ORM relation planning and future relation typing needed to know which named relations exist, which model they point to, whether they are single-valued or collection-valued, and which storage keys back them.

Many-to-many relationships add a third constraint. A many-to-many relation is not one stored column on one table, so it cannot be represented faithfully by pretending there is a `tags` column on `posts`. It needed a relation-level home immediately, and a join-table story eventually.

## Where things went wrong

The old architecture asked those two kinds of consumers to recover their answers from different sources.

Field decorators already knew a great deal about a relation. A declaration such as `authorId: t.foreignKey(UserModel, { field: z.number().int() })` already carried the source field, the target model reference, uniqueness hints, and any explicit column mapping. The storage pipeline could use that information because it was working directly from field metadata.

The relation side of the system did not keep that same information in a first-class shape. It often had to reconstruct relation meaning later from a mix of `Field[]` and `relations: (r) => ...` declarations. By the time it reached that stage, some of the original author intent had already been flattened into storage-oriented metadata.

As a result, one side of the system treated field metadata as the source of storage truth, while the other side treated named relations as the source of relation truth. Contributors had to reason about those surfaces in parallel and trust that they still described the same edge.

That split was especially weak in three places.

First, storage truth and relation truth could drift apart. A model could carry reference metadata on one side and a separately named relation on the other side, and the architecture did not make one shared intermediate representation explicit.

Second, reverse relations were rebuilt later from weaker information. A forward `authorId` declaration strongly implies `Post.author`, but the reverse `User.posts` relation was not preserved as a first-class artifact at the same point in the pipeline.

Third, many-to-many declarations had no durable architectural home. Tango could accept the declaration syntax, but the seam still centered on stored columns, so M2M intent had nowhere stable to live once model construction finished.

## Recovering the lost capabilities

Addressing the issues in the old architecture required refactoring relation management to introduce a single normalized relation source and make both storage and relation artifacts derive from it.

A model declaration now moves through a relation-normalization stage before storage inference throws information away. That normalized layer preserves the author intent that both sides of the system need.

From that shared normalized source, Tango derives two coordinated artifacts.

- `Field[]` remains the canonical storage artifact.
- `ResolvedRelationGraph` becomes the canonical relation artifact.

That architectural split gives each side of the system a contract shaped for its own job while keeping both contracts tied back to one source of truth.

At a conceptual level, the seam now looks like this:

<MermaidDiagram
    diagram-id="relation-seam-overview"
    semantic-palette="relation-seam"
    :chart='[
        "flowchart TD",
        "    subgraph CONSTRUCTION[\"<b style=\"font-size: 18px;\">Construction Phase</b>\"]",
        "        direction TB",
        "        MODEL_DECLARATION[\"<b>Model Declaration</b>\n<code>Model(...)</code>\"] -->|contains| FIELD_DECORATOR[\"<b>Field Decorator</b>\n<code>t.foreignKey(...)</code>\"]",
        "        MODEL_DECLARATION -->|may define| RELATIONS_DECLARATION[\"<b>Relations Declaration</b>\n<code>relations: (r) =&gt; ...</code>\"]",
        "    end",
        "    FIELD_DECORATOR -->|normalizes into| NORMALIZED_RELATION_DESCRIPTOR[\"<b>Normalized Relation Descriptor</b>\n<code>NormalizedRelationStorageDescriptor[]</code>\"]",
        "    RELATIONS_DECLARATION -->|contributes names to| NORMALIZED_RELATION_DESCRIPTOR",
        "    subgraph FINALIZATION[\"<b style=\"font-size: 18px;\">Finalization Phase</b>\"]",
        "        direction TB",
        "        NORMALIZED_RELATION_DESCRIPTOR -->|derives| FINALIZED_FIELD[\"<b>Finalized Field</b>\n<code>Field[]</code>\"]",
        "        NORMALIZED_RELATION_DESCRIPTOR -->|derives| RESOLVED_RELATION_GRAPH[\"<b>Resolved Relation Graph</b>\n<code>ResolvedRelationGraph</code>\"]",
        "        FINALIZED_FIELD -->|drives| MIGRATION_MANAGER[\"<b>Migration Manager</b>\n<code>schema planning</code>\"]",
        "        FINALIZED_FIELD -->|shapes| ORM_TABLE_META[\"<b>ORM Table Meta</b>\n<code>objects.meta.fields</code>\"]",
        "        RESOLVED_RELATION_GRAPH -->|shapes| ORM_RELATION_META[\"<b>ORM Relation Meta</b>\n<code>objects.meta.relations</code>\"]",
        "        ORM_TABLE_META -->|informs| ORM_MODEL_MANAGER[\"<b>ORM Model Manager</b>\n<code>Model.objects</code>\"]",
        "        ORM_RELATION_META -->|informs| ORM_MODEL_MANAGER",
        "    end",
        "    class MODEL_DECLARATION,MIGRATION_MANAGER,ORM_MODEL_MANAGER appFacing",
        "    class FIELD_DECORATOR,RELATIONS_DECLARATION authoring",
        "    class NORMALIZED_RELATION_DESCRIPTOR,ORM_TABLE_META,ORM_RELATION_META,FINALIZED_FIELD,RESOLVED_RELATION_GRAPH artifact"
    ].join("\n")'
/>

The architecture now now enables both artifacts to derive from one shared explicit normalized predecessor layer instead of being derived independently from partially overlapping inputs.

Before looking at the normalized layer directly, it helps to separate model construction from registry finalization.

The construction phase is where Tango captures explicit relation names, normalizes field-authored relation intent, and binds the model to its owning registry.

<MermaidDiagram
    diagram-id="relation-seam-construction-sequence"
    :chart='[
        "sequenceDiagram",
        "    participant A as App",
        "    participant M as Model",
        "    participant G as Registry",
        "    participant I as InternalModel",
        "    participant R as Builder",
        "    participant N as Normalizer",
        "    A->>M: declare definition",
        "    M->>G: active()",
        "    M->>I: create(definition, registry)",
        "    I->>R: build explicit relations",
        "    I->>N: normalize descriptors",
        "    I->>I: attach metadata + lazy fields",
        "    I-->>M: internal model",
        "    M->>G: register(model)"
    ].join("\n")'
/>

That construction phase preserves registry ownership and normalized relation intent for later finalization.

::: info `Model` vs `InternalModel`
The diagram names both `Model` and `InternalModel` because they play different roles: `Model(...)` is the public factory contributors call, while the returned internal model instance carries the normalized relation descriptors, registry ownership, and lazy finalized field view that later stages consume.
:::

The finalization phase is where the registry turns that preserved intent into storage artifacts and a resolved relation graph. Most application code reaches this phase indirectly through `Model.objects` and `ModelManager`, even though the registry is still the component that owns the caches and performs the finalization work.

<MermaidDiagram
    diagram-id="relation-seam-finalization-sequence"
    :chart='[
        "sequenceDiagram",
        "    participant A as App",
        "    participant M as ModelManager",
        "    participant G as Registry",
        "    participant F as FieldInference",
        "    participant B as GraphBuilder",
        "    A->>M: first query / read objects.meta",
        "    M->>G: finalize storage / read metadata.fields",
        "    G->>F: infer fields",
        "    F-->>G: Field[]",
        "    M->>G: getResolvedRelationGraph()",
        "    G->>B: build relation graph",
        "    B-->>G: ResolvedRelationGraph",
        "    G-->>M: finalized meta",
        "    M-->>A: queryable model surface"
    ].join("\n")'
/>

The next section starts with `NormalizedRelationStorageDescriptor[]` because it is the handoff shape between those two phases.

## The normalized source

`NormalizedRelationStorageDescriptor[]` is the handoff layer between relation authoring and all later finalization work.

A normalized descriptor keeps the parts of relation intent that both storage and relation semantics need:

- the source model key, so later stages know which model authored the edge and which registry-owned model record the descriptor belongs to
- the source schema field key, so resolution can still point back to the original schema field such as `authorId` rather than only to a derived database column name
- the target model reference, so both storage finalization and relation resolution know which model the edge points to before that reference has been resolved into registry-scoped artifacts
- the declared relation origin such as foreign key, one-to-one, or many-to-many, so later stages can preserve the semantic difference between “stored reference column,” “unique reference column,” and “collection relation that cannot become one concrete field”
- storage-oriented details such as column names and referenced target columns, so the storage pipeline can derive `Field[]` without having to rediscover author intent from the schema a second time
- naming hints and provenance, so relation resolution can derive forward and reverse relation names while still remembering whether a name came from field authorship, explicit `relations`, or a synthesized default

That normalized layer is still pre-resolution. It does not yet say what the final reverse relation name will be, whether an override matched, or which inverse edge has been paired with which forward edge. It preserves author intent in a form that later stages can resolve deterministically.

## Registry ownership and staged finalization

Once relation intent has been normalized, later stages need an owning scope that can answer two questions consistently: which models are available for cross-model resolution, and which finalized artifacts belong together as one coherent snapshot.

That owning scope cannot be the model object by itself. A single model can point at other models, derive reverse relations from them, and participate in caches that only make sense relative to one complete set of registered models.

Tango gives that owning scope a concrete name: `ModelRegistry` and enforces an architectural invariant that a model instance must belong to exactly one `ModelRegistry`.

That invariant exists because finalized storage artifacts and resolved relation graphs are registry-scoped caches. One model object cannot safely publish different finalized `Field[]` values or different resolved relation graphs for multiple registries at once.

Once that ownership boundary is in place, the registry can finalize the two artifact layers in sequence.

### Storage finalization

At this point the system needs to know which concrete fields exist, which one is the primary key, which columns carry reference metadata, and which storage-level details can be published to migrations and field-oriented tooling.

Tango performs that stage through `ModelRegistry.finalizeStorageArtifacts()`, which derives concrete `Field[]` for every model in the registry.

<MermaidDiagram
    diagram-id="storage-finalization-sequence"
    :chart='[
        "sequenceDiagram",
        "    participant C as Caller",
        "    participant R as ModelRegistry",
        "    participant F as inferFieldsFromSchema",
        "    C->>R: finalizeStorageArtifacts()",
        "    alt storage cache matches registry version",
        "        R-->>C: cached FinalizedStorageArtifacts",
        "    else cache miss",
        "        R->>R: collect primary keys by model",
        "        loop for each registered model",
        "            R->>F: inferFieldsFromSchema(model.schema, ...)",
        "            F->>R: resolveRef(target) / primary key lookup",
        "            F-->>R: inferred fields",
        "            R->>R: merge explicit fields and freeze finalized fields",
        "        end",
        "        R->>R: publish storage cache entry",
        "        R-->>C: FinalizedStorageArtifacts",
        "    end"
    ].join("\n")'
/>

### Relation finalization

Once storage artifacts exist, the system can resolve named forward edges, synthesize reverse edges, match explicit overrides, and decide which final relation names belong on each model.

That work has to come second because relation semantics depend on concrete storage answers. Before storage finalization, the system does not yet know the finalized field set for each model, which field is the primary key, which reference columns actually survived field derivation, or which target column a relation ultimately points at. Reverse-edge synthesis and override matching only become deterministic once those storage questions have already been answered.

Tango performs that stage through `ModelRegistry.getResolvedRelationGraph()`, which starts from finalized storage artifacts and resolves named relation semantics on top of them.

<MermaidDiagram
    diagram-id="relation-finalization-sequence"
    :chart='[
        "sequenceDiagram",
        "    participant C as Caller",
        "    participant R as ModelRegistry",
        "    participant B as ResolvedRelationGraphBuilder",
        "    C->>R: getResolvedRelationGraph()",
        "    alt relation graph cache matches registry version",
        "        R-->>C: cached ResolvedRelationGraph",
        "    else cache miss",
        "        R->>R: finalizeStorageArtifacts()",
        "        R->>B: build({ models, storage, resolveRef })",
        "        loop for each normalized descriptor",
        "            B->>R: resolveRef(targetRef)",
        "            B->>B: match overrides and synthesize reverse edges",
        "        end",
        "        B-->>R: ResolvedRelationGraph",
        "        R->>R: publish relation graph cache entry",
        "        R-->>C: ResolvedRelationGraph",
        "    end"
    ].join("\n")'
/>

### Atomic publish semantics

Each stage publishes atomically per registry version because finalization is only useful if every consumer sees one coherent snapshot.

A registry version represents one stable set of registered models. When finalization starts, the registry derives a fresh temporary artifact set for that version, runs validation against the temporary result, freezes the successful result, and only then swaps the cache pointer to the new entry. Until that final publish step happens, every consumer continues reading the previous successful cache entry.

A failure in atomicity would result in a half-published snapshot, which in turn would let different parts of the system observe different answers to the same model graph. For example, storage consumers could see a newly finalized `Field[]` with one primary key or one resolved reference column while relation consumers still see an older relation graph derived from a previous field set. In that state, reverse-edge synthesis, alias generation, or ORM metadata publication could point at fields that no longer match the active storage artifact.

In practice, such a failure would surface as concrete bugs: relation names resolved against stale target columns, ORM relation metadata disagreeing with `objects.meta.fields`, or one consumer seeing a model edge that another consumer cannot validate against the current storage snapshot.

Atomic publish semantics avoid that class of bug. Storage finalization can therefore stand on its own, relation finalization can build on a stable storage snapshot, and a failed recomputation simply leaves the last coherent registry version in place.

## How relation semantics are resolved

A field-authored relation such as `authorId: t.foreignKey(UserModel, { field: z.number().int() })` does not become a named relation immediately. During model construction, Tango records the source model key, the source schema field key, the target model reference, the storage strategy, and any naming hints from that decorator into one `NormalizedRelationStorageDescriptor[]` entry.

Relation finalization then revisits that descriptor after storage has been finalized. At that point, the registry can resolve the target model, confirm which concrete field survives as the reference column, determine the target primary key, and match any explicit `relations: (r) => ...` overrides against the descriptor's stable author-time facts.

Once those answers are available, the descriptor becomes two resolved relation edges: a named forward edge on the source model and a corresponding reverse edge on the target model. The reverse edge cardinality comes from the finalized storage shape, so a unique foreign key becomes `hasOne` while a non-unique foreign key becomes `hasMany`.

A simple blog example looks like this:

<MermaidDiagram
    diagram-id="resolved-relations-blog-erd"
    :chart='[
        "erDiagram",
        "    direction LR",
        "    USER ||--o{ POST : \"author / posts\"",
        "    USER {",
        "        int id PK",
        "        string email",
        "    }",
        "    POST {",
        "        int id PK",
        "        int authorId FK",
        "        string title",
        "    }"
    ].join("\n")'
/>

In resolved form, that edge becomes:

- `Post.author` -> `belongsTo User`
- `User.posts` -> `hasMany Post`

A one-to-one edge follows the same pattern, but the reverse side stays single-valued when the source field is unique:

<MermaidDiagram
    diagram-id="resolved-relations-one-to-one-erd"
    :chart='[
        "erDiagram",
        "    direction LR",
        "    USER ||--|| PROFILE : \"user / profile\"",
        "    USER {",
        "        int id PK",
        "        string email",
        "    }",
        "    PROFILE {",
        "        int id PK",
        "        int userId FK, UK",
        "        string bio",
        "    }"
    ].join("\n")'
/>

In resolved form, that edge becomes:

- `Profile.user` -> `belongsTo User`
- `User.profile` -> `hasOne Profile`

## Named relations and overrides

Field-authored relation metadata is the path forward for straightforward storage-backed cases. A plain `t.foreignKey(...)` can produce the forward `belongsTo` edge and a synthesized reverse `hasMany`, while a unique reference such as `t.oneToOne(...)` can produce a synthesized reverse `hasOne`.

The object-form field decorators also carry the explicit names that used to require a separate model-level `relations` block. The old relation block maps to the new decorator options like this:

- `author: r.belongsTo('blog/User', 'authorId')` maps to `authorId: t.foreignKey('blog/User', { name: 'author' })`
- `posts: r.hasMany('blog/Post', 'authorId')` maps to the reverse hint on the owning field: `authorId: t.foreignKey('blog/User', { relatedName: 'posts' })`
- `profile: r.hasOne('blog/Profile', 'userId')` maps to a unique owning field such as `userId: t.oneToOne('blog/User', { relatedName: 'profile' })`

`relations` is the solution that shipped with the original architecture. It remains supported for compatibility and for model-level ambiguity resolution, but it is on the deprecation path for simple storage-backed relation names. New relation naming should prefer `name` and `relatedName` on the field decorator. That keeps storage truth and relation naming intent attached to the same authoring site.

An override can rename a forward or reverse edge, but it cannot contradict storage truth. It cannot point at a different target model, invent a different key mapping, or turn a non-unique reverse edge into `hasOne`.

Override matching happens during normalization and resolution against stable author-time facts such as the source schema field key and relation kind. Downstream code uses the resulting `edgeId` instead of re-matching relation names heuristically.

## Reverse naming rules

Reference-backed reverse edges use one deterministic naming strategy.

The registry applies naming in this order:

1. an explicit reverse-name override from `relations`
2. an explicit `relatedName` from the field decorator
3. `defaultRelatedName` on the source model
4. deterministic derivation from the source model name

If two edges would produce the same reverse name, relation finalization fails and requires an explicit override.

That behavior is what keeps a model with both `authorId` and `editorId` pointing at `User` from silently producing unstable reverse names.

## Many-to-many status

Many-to-many declarations now have a durable home in the seam even though full ORM support is still fenced.

A declaration such as:

```ts
const PostModel = Model({
    namespace: 'blog',
    name: 'Post',
    schema: z.object({
        id: t.primaryKey(z.number().int()),
        tags: t.manyToMany('blog/Tag'),
    }),
});
```

now records relation intent without pretending that `posts` stores a `tags` column.

In the current architecture:

- `t.manyToMany(...)` emits no storage `Field`
- it is excluded from persisted row contracts
- it is represented in the normalized relation layer and the resolved relation graph
- its capability flags remain fenced until the join-table story is implemented

The seam already leaves space for auto-through and explicit-through metadata, so later M2M work can extend the relation pipeline without redesigning the seam again.

A conceptual future ERD looks like this:

<MermaidDiagram
    diagram-id="future-many-to-many-through-erd"
    :chart='[
        "erDiagram",
        "    direction LR",
        "    POST ||--o{ POST_TAG : \"through postId\"",
        "    TAG ||--o{ POST_TAG : \"through tagId\"",
        "    POST {",
        "        int id PK",
        "        string title",
        "    }",
        "    POST_TAG {",
        "        int postId FK",
        "        int tagId FK",
        "        string role",
        "    }",
        "    TAG {",
        "        int id PK",
        "        string name",
        "    }"
    ].join("\n")'
/>

Future endpoint relations:

- Post.tags
- Tag.posts
