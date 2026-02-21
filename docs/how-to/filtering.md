# How to add filtering

`FilterSet` lets a resource publish a deliberate query-parameter contract instead of exposing raw ORM filter syntax directly to callers.

The current API is centered on `FilterSet.define(...)`. That API starts from model fields, then lets you layer in public parameter aliases, lookup choices, parser hooks, and custom resolver logic where the endpoint needs it.

## Start with an allowlist

Filtering is allowlist-first by default. A filter only exists when you declare it.

```ts
import { FilterSet } from '@danceroutine/tango-resources';

type Post = {
    id: number;
    title: string;
    content: string;
    authorId: number;
    published: boolean;
    createdAt: string;
};

export const postFilters = FilterSet.define<Post>({
    fields: {
        authorId: true,
        published: true,
    },
});
```

`true` means exact matching on the same public parameter name:

- `authorId=42` becomes `{ authorId: '42' }`
- `published=false` becomes `{ published: 'false' }`

Unknown query parameters are ignored unless you explicitly opt into `__all__`.

## Declare lookup families per field

When an endpoint should support more than exact matching, declare the allowed lookups for that field.

```ts
export const postFilters = FilterSet.define<Post>({
    fields: {
        id: ['exact', 'in', 'lt', 'lte', 'gt', 'gte'],
        title: ['icontains', 'contains', 'startswith', 'istartswith', 'endswith', 'iendswith'],
        published: ['exact', 'isnull'],
        createdAt: ['gte', 'lte'],
    },
});
```

Those declarations generate Django-style parameter names:

- `id=3`
- `id__in=1,2,3`
- `id__gte=10`
- `title__icontains=tango`
- `title__startswith=The`
- `published__isnull=false`
- `createdAt__lte=2026-12-31`

The built-in field-first API currently supports these lookup shapes:

- exact equality through `exact` or `true`
- set membership through `in`
- range comparisons through `lt`, `lte`, `gt`, and `gte`
- text matching through `contains`, `icontains`, `startswith`, `istartswith`, `endswith`, and `iendswith`
- null checks through `isnull`

## Rename a public parameter without renaming the field

Field declarations can expose a different public parameter name through `param`.

```ts
export const postFilters = FilterSet.define<Post>({
    fields: {
        published: {
            param: 'is_published',
        },
    },
});
```

That resource now accepts `?is_published=true`, while the underlying filter still targets `published`.

`param` is useful when:

- a field name is awkward in a public API
- an older endpoint needs a compatibility alias
- you want the request contract to read more clearly than the database column name

## Parse values into application-level types

By default, `FilterSet` passes raw query-string values through as strings or string arrays. Parser hooks let you coerce those values before the ORM filter is built.

You can attach parsers in two places:

- `parsers`, keyed by field name
- `parse` inside a field or alias declaration

```ts
export const postFilters = FilterSet.define<Post>({
    fields: {
        authorId: ['exact', 'in'],
        published: {
            param: 'is_published',
            parse: (raw) => {
                const value = Array.isArray(raw) ? raw[0] : raw;
                if (value === 'true') return true;
                if (value === 'false') return false;
                return undefined;
            },
        },
    },
    parsers: {
        authorId: (raw) => {
            const value = Array.isArray(raw) ? raw[0] : raw;
            const parsed = Number(value);
            return Number.isNaN(parsed) ? undefined : parsed;
        },
    },
});
```

The parser contract is intentionally simple:

- returning a value applies the filter with that parsed value
- returning `undefined` omits that filter entirely
- throwing an error lets the normal request error path handle the failure

When both a field-level parser map and a declaration-level `parse` hook exist, the declaration-level parser wins for that filter.

## Add public aliases

Aliases let the public query interface diverge from the model field names without forcing you into the lower-level constructor API.

### Single-field aliases

Single-field aliases map one public parameter to one field and one lookup.

```ts
export const postFilters = FilterSet.define<Post>({
    aliases: {
        author: { field: 'authorId' },
        created_after: { field: 'createdAt', lookup: 'gte' },
    },
});
```

That configuration accepts:

- `author=42`
- `created_after=2026-01-01`

### Multi-field aliases

Multi-field aliases apply the same lookup across several fields.

```ts
export const postFilters = FilterSet.define<Post>({
    aliases: {
        text: {
            fields: ['title', 'content'],
            lookup: 'contains',
        },
    },
});
```

`text=hello` produces one composed filter fragment that targets both fields.

This is useful when one public parameter should constrain several fields at once. It is not the same feature as `searchFields` on `GenericAPIView` or `ModelViewSet`.

Use `searchFields` when you want Tango's built-in OR-style free-text search through the `search` query parameter. Use a multi-field alias when you want one named filter parameter to build one explicit composed filter.

If you omit `lookup` on a multi-field alias, it defaults to `icontains`.

## Repeated parameters and `in` filters

`in` filters accept both comma-separated values and repeated query parameters.

```ts
export const postFilters = FilterSet.define<Post>({
    fields: {
        id: ['in'],
    },
});
```

These requests are both valid:

- `?id__in=1,2,3`
- `?id__in=1&id__in=2&id__in=3`

The filter set normalizes both forms into the `__in` lookup shape the ORM expects.

## Use `__all__` only for explicitly permissive endpoints

`FilterSet` stays allowlist-first unless you opt into catch-all behavior:

```ts
const permissiveFilters = FilterSet.define<Post>({
    all: '__all__',
});
```

In `__all__` mode, unknown query parameters are translated into filter fragments instead of being ignored.

That mode is useful for internal tools, debugging endpoints, or admin-style surfaces where flexibility matters more than a tightly documented public contract. Application-facing APIs should usually stay explicit.

## Attach the filter set to a resource

`GenericAPIView` and `ModelViewSet` both accept a `filters` option.

```ts
class PostSerializer extends ModelSerializer<
    Post,
    typeof PostWriteSchema,
    ReturnType<typeof PostWriteSchema.partial>,
    typeof PostReadSchema
> {
    static readonly model = PostModel;
    static readonly createSchema = PostWriteSchema;
    static readonly updateSchema = PostWriteSchema.partial();
    static readonly outputSchema = PostReadSchema;
}

class PostViewSet extends ModelViewSet<Post, typeof PostSerializer> {
    constructor() {
        super({
            serializer: PostSerializer,
            filters: postFilters,
            orderingFields: ['createdAt', 'title'],
            searchFields: ['title', 'content'],
        });
    }
}
```

At request time, Tango:

1. reads `URLSearchParams`
2. asks `FilterSet` for the declared filter fragments
3. combines those fragments with `Q.and(...)`
4. applies the result to the manager-backed query

That means multiple declared filters narrow the result set together.

## Keep the constructor form for fully custom resolvers

The original constructor API still works and remains the right tool when a filter does not fit the field-first declaration model.

```ts
new FilterSet<Post>({
    authorId: { type: 'scalar', column: 'authorId' },
    created_after: { type: 'range', column: 'createdAt', op: 'gte' },
    ids: { type: 'in', column: 'id' },
    domain: {
        type: 'custom',
        apply: (value) => {
            if (!value) return undefined;
            return { title__iendswith: `@${value}` };
        },
    },
});
```

Use the constructor form when you need:

- a resolver shape that `define(...)` does not describe cleanly
- full control over the produced filter fragment
- compatibility with older code that already uses resolver objects

For new application code, `FilterSet.define(...)` is usually the clearer default because it keeps the public filter contract centered on fields and named aliases.

## Related pages

- [Resources and viewsets](/topics/resources-and-viewsets)
- [Resources API](/reference/resources-api)
- [ORM query API](/reference/orm-query-api)
