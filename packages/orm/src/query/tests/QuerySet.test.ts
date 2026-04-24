import { describe, expect, expectTypeOf, it, vi } from 'vitest';
import { aQueryExecutor, aRelationMeta } from '@danceroutine/tango-testing';
import { Model, t, type PersistedModelOutput } from '@danceroutine/tango-schema';
import { z } from 'zod';
import { ModelQuerySet } from '../ModelQuerySet';
import { QuerySet } from '../QuerySet';
import { QBuilder as Q } from '../QBuilder';
import type { HydratedQueryResult } from '../domain/RelationTyping';
import type { TableMeta } from '../domain/TableMeta';
import type { CompiledQuery } from '../domain/CompiledQuery';
import { InternalPrefetchQueryKind } from '../domain/internal/InternalPrefetchQueryKind';
import { InternalRelationKind } from '../domain/internal/InternalRelationKind';

type User = {
    id: number;
    email: string;
    active: boolean;
};

type MultiBoolUser = User & {
    verified: boolean;
};

const TypedUserModel = Model({
    namespace: 'typed_query',
    name: 'User',
    table: 'typed_query_users',
    schema: z.object({
        id: t.primaryKey(z.number().int()),
        email: z.string(),
    }),
});

const TypedPostModel = Model({
    namespace: 'typed_query',
    name: 'Post',
    table: 'typed_query_posts',
    schema: z.object({
        id: t.primaryKey(z.number().int()),
        author: t.foreignKey(t.modelRef<typeof TypedUserModel>('typed_query/User'), {
            relatedName: 'posts',
        }),
        title: z.string(),
    }),
});

const TypedProfileModel = Model({
    namespace: 'typed_query',
    name: 'Profile',
    table: 'typed_query_profiles',
    schema: z.object({
        id: t.primaryKey(z.number().int()),
        user: t.oneToOne(t.modelRef<typeof TypedUserModel>('typed_query/User'), {
            relatedName: 'profile',
        }),
        displayName: z.string(),
    }),
});

const UnrelatedModel = Model({
    namespace: 'typed_query',
    name: 'Unrelated',
    table: 'typed_query_unrelated',
    schema: z.object({
        id: t.primaryKey(z.number().int()),
    }),
});

type TypedUserRow = PersistedModelOutput<typeof TypedUserModel.schema>;
type TypedPostRow = PersistedModelOutput<typeof TypedPostModel.schema>;
type TypedProfileRow = PersistedModelOutput<typeof TypedProfileModel.schema>;

declare global {
    interface TangoGeneratedRelationRegistry {
        'typed_query/User': {
            profile: { target: typeof TypedProfileModel; cardinality: 'single' };
            posts: { target: typeof TypedPostModel; cardinality: 'many' };
        };
        'typed_query/Post': {
            author: { target: typeof TypedUserModel; cardinality: 'single' };
        };
        'typed_query/Profile': {
            user: { target: typeof TypedUserModel; cardinality: 'single' };
        };
    }
}

type QuerySetRows<TQuerySet> =
    TQuerySet extends QuerySet<
        infer _TModel extends Record<string, unknown>,
        infer TBaseResult extends Record<string, unknown>,
        infer _TSourceModel,
        infer THydrated extends Record<string, unknown>
    >
        ? Array<HydratedQueryResult<TBaseResult, THydrated>>
        : never;

const meta: TableMeta = {
    table: 'users',
    pk: 'id',
    columns: {
        id: 'int',
        email: 'text',
        active: 'bool',
    },
};

const relatedMeta: TableMeta = {
    ...meta,
    relations: {
        team: aRelationMeta({
            kind: InternalRelationKind.BELONGS_TO,
            table: 'teams',
            sourceKey: 'id',
            targetKey: 'id',
            targetColumns: { id: 'int', name: 'text' },
            alias: 'team',
        }),
        posts: aRelationMeta({
            kind: InternalRelationKind.HAS_MANY,
            table: 'posts',
            sourceKey: 'id',
            targetKey: 'author_id',
            targetColumns: { id: 'int', author_id: 'int', title: 'text' },
            alias: 'posts',
        }),
        articles: aRelationMeta({
            kind: InternalRelationKind.HAS_MANY,
            table: 'articles',
            sourceKey: 'id',
            targetKey: 'author_id',
            targetColumns: { id: 'int', author_id: 'int', headline: 'text' },
            alias: 'articles',
        }),
    },
};

function createQueryExecutorFixture(
    rows: User[] = [],
    dialect: 'postgres' | 'sqlite' = 'postgres',
    tableMeta: TableMeta = meta
) {
    const run = vi.fn(async (_compiled: { sql: string; params: readonly unknown[] }) => rows);
    const query = vi.fn(async (_sql: string, _params?: readonly unknown[]) => ({ rows: [{ count: rows.length }] }));
    const queryExecutor = aQueryExecutor<User>({ meta: tableMeta, dialect, query, run });
    return { queryExecutor, run, query };
}

describe(QuerySet, () => {
    it('supports filter/exclude/order/limit/offset/select/selectRelated/prefetchRelated chaining', async () => {
        const { queryExecutor, run } = createQueryExecutorFixture(
            [{ id: 1, email: 'a@a.com' } as User],
            'postgres',
            relatedMeta
        );
        const qs = new ModelQuerySet<User>(queryExecutor);

        const result = await qs
            .filter({ active: true })
            .exclude({ email__contains: 'spam' })
            .orderBy('-id', 'email')
            .limit(10)
            .offset(20)
            .select(['id', 'email'])
            .selectRelated('team')
            .prefetchRelated('posts')
            .fetch();

        expect(result.results).toEqual([{ id: 1, email: 'a@a.com', team: null, posts: [] }]);
        expect(run).toHaveBeenCalledOnce();
        expect(QuerySet.isQuerySet(qs)).toBe(true);
        expect(QuerySet.isQuerySet({})).toBe(false);
    });

    it('clones the current queryset state when all() is called', async () => {
        const { queryExecutor, run } = createQueryExecutorFixture([{ id: 1, email: 'all@a.com', active: true }]);
        const base = new ModelQuerySet<User>(queryExecutor).filter({ active: true }).orderBy('-id');

        const cloned = base.all();
        await cloned.fetch();

        expect(cloned).not.toBe(base);
        expect(run).toHaveBeenCalledOnce();
        expect(run.mock.calls[0]?.[0]?.sql ?? '').toContain('ORDER BY users.id DESC');
    });

    it('hydrates single-valued selectRelated rows from aliased target columns', async () => {
        const run = vi.fn(async () => [
            {
                id: 1,
                email: 'a@a.com',
                active: true,
                __tango_hydrate_team_id: 10,
                __tango_hydrate_team_name: 'Core',
            },
            {
                id: 2,
                email: 'b@a.com',
                active: false,
                __tango_hydrate_team_id: null,
                __tango_hydrate_team_name: null,
            },
        ]);
        const queryExecutor = aQueryExecutor<Record<string, unknown>>({ meta: relatedMeta, run });

        const result = await new ModelQuerySet<Record<string, unknown>>(queryExecutor).selectRelated('team').fetch();

        expect(result.results).toEqual([
            {
                id: 1,
                email: 'a@a.com',
                active: true,
                team: { id: 10, name: 'Core' },
            },
            {
                id: 2,
                email: 'b@a.com',
                active: false,
                team: null,
            },
        ]);
        expect(Object.keys(result.results[0]!)).not.toContain('__tango_hydrate_team_id');
    });

    it('hydrates hasMany prefetch rows with stable grouping and base row order', async () => {
        const run = vi.fn(async () => [
            { id: 1, email: 'a@a.com', active: true },
            { id: 2, email: 'b@a.com', active: false },
            { id: 1, email: 'duplicate@a.com', active: true },
        ]);
        const query = vi.fn(async () => ({
            rows: [
                { id: 100, author_id: 1, title: 'A' },
                { id: 101, author_id: 1, title: 'B' },
                { id: 999, author_id: 999, title: 'Ignored' },
            ],
        }));
        const queryExecutor = aQueryExecutor<Record<string, unknown>>({ meta: relatedMeta, run, query });

        const result = await new ModelQuerySet<Record<string, unknown>>(queryExecutor).prefetchRelated('posts').fetch();

        expect(result.results).toEqual([
            {
                id: 1,
                email: 'a@a.com',
                active: true,
                posts: [
                    { id: 100, author_id: 1, title: 'A' },
                    { id: 101, author_id: 1, title: 'B' },
                ],
            },
            { id: 2, email: 'b@a.com', active: false, posts: [] },
            {
                id: 1,
                email: 'duplicate@a.com',
                active: true,
                posts: [
                    { id: 100, author_id: 1, title: 'A' },
                    { id: 101, author_id: 1, title: 'B' },
                ],
            },
        ]);
        expect(query).toHaveBeenCalledWith(expect.stringContaining('author_id IN'), [1, 2]);
    });

    it('reuses canonical joined entities across base rows', async () => {
        const run = vi.fn(async () => [
            {
                id: 1,
                email: 'a@a.com',
                active: true,
                __tango_hydrate_team_id: 10,
                __tango_hydrate_team_name: 'Core',
            },
            {
                id: 2,
                email: 'b@a.com',
                active: false,
                __tango_hydrate_team_id: 10,
                __tango_hydrate_team_name: 'Core',
            },
        ]);
        const queryExecutor = aQueryExecutor<Record<string, unknown>>({ meta: relatedMeta, run });

        const result = await new ModelQuerySet<Record<string, unknown>>(queryExecutor).selectRelated('team').fetch();

        expect(result.results[0]!.team).toBe(result.results[1]!.team);
    });

    it('normalizes sqlite target booleans during relation hydration', async () => {
        const sqliteRelatedMeta: TableMeta = {
            ...relatedMeta,
            relations: {
                team: aRelationMeta({
                    kind: InternalRelationKind.BELONGS_TO,
                    table: 'teams',
                    sourceKey: 'id',
                    targetKey: 'id',
                    targetColumns: { id: 'int', enabled: 'bool' },
                    alias: 'team',
                }),
                posts: aRelationMeta({
                    kind: InternalRelationKind.HAS_MANY,
                    table: 'posts',
                    sourceKey: 'id',
                    targetKey: 'author_id',
                    targetColumns: { id: 'int', author_id: 'int', published: 'bool' },
                    alias: 'posts',
                }),
            },
        };
        const run = vi.fn(async () => [
            { id: 1, email: 'a@a.com', active: 1, __tango_hydrate_team_id: 10, __tango_hydrate_team_enabled: 1 },
        ]);
        const query = vi.fn(async () => ({
            rows: [
                { id: 100, author_id: 1, published: 0 },
                { id: 101, author_id: null, published: 1 },
                { id: 102, author_id: 1, published: 2 },
            ],
        }));
        const queryExecutor = aQueryExecutor<Record<string, unknown>>({
            meta: sqliteRelatedMeta,
            dialect: 'sqlite',
            run,
            query,
        });

        const result = await new ModelQuerySet<Record<string, unknown>>(queryExecutor)
            .selectRelated('team')
            .prefetchRelated('posts')
            .fetch({ parse: (row) => row });

        expect(result.results).toEqual([
            {
                id: 1,
                email: 'a@a.com',
                active: true,
                team: { id: 10, enabled: true },
                posts: [
                    { id: 100, author_id: 1, published: false },
                    { id: 102, author_id: 1, published: 2 },
                ],
            },
        ]);
    });

    it('strips hidden prefetch grouping keys from projected base rows', async () => {
        const run = vi.fn(async () => [{ email: 'a@a.com', __tango_prefetch_posts_id: 1 }]);
        const query = vi.fn(async () => ({ rows: [] as Record<string, unknown>[] }));
        const queryExecutor = aQueryExecutor<Record<string, unknown>>({ meta: relatedMeta, run, query });

        const result = await new ModelQuerySet<Record<string, unknown>>(queryExecutor)
            .select(['email'] as const)
            .prefetchRelated('posts')
            .fetch();

        expect(result.results).toEqual([{ email: 'a@a.com', posts: [] }]);
        expect(query).toHaveBeenCalledWith(expect.stringContaining('author_id IN'), [1]);
    });

    it('uses projected prefetch source keys for every requested relation before stripping them', async () => {
        const run = vi.fn(async () => [
            {
                email: 'a@a.com',
                __tango_prefetch_posts_id: 1,
                __tango_prefetch_articles_id: 1,
            },
        ]);
        const query = vi.fn(async (sql: string) => ({
            rows: sql.includes('articles')
                ? [{ id: 200, author_id: 1, headline: 'Type-safe relations' }]
                : [{ id: 100, author_id: 1, title: 'Hydration' }],
        }));
        const queryExecutor = aQueryExecutor<Record<string, unknown>>({ meta: relatedMeta, run, query });

        const result = await new ModelQuerySet<Record<string, unknown>>(queryExecutor)
            .select(['email'] as const)
            .prefetchRelated('posts', 'articles')
            .fetch();

        expect(result.results).toEqual([
            {
                email: 'a@a.com',
                posts: [{ id: 100, author_id: 1, title: 'Hydration' }],
                articles: [{ id: 200, author_id: 1, headline: 'Type-safe relations' }],
            },
        ]);
        expect(result.results[0]).not.toHaveProperty('__tango_prefetch_posts_id');
        expect(query).toHaveBeenCalledTimes(2);
        expect(query).toHaveBeenNthCalledWith(1, expect.stringContaining('author_id IN'), [1]);
        expect(query).toHaveBeenNthCalledWith(2, expect.stringContaining('author_id IN'), [1]);
    });

    it('recurses into nested prefetch paths and skips empty child owner collections', async () => {
        const nestedMeta: TableMeta = {
            ...meta,
            relations: {
                posts: aRelationMeta({
                    kind: InternalRelationKind.HAS_MANY,
                    table: 'posts',
                    sourceKey: 'id',
                    targetKey: 'author_id',
                    targetColumns: { id: 'int', author_id: 'int' },
                    alias: 'posts',
                    targetMeta: {
                        table: 'posts',
                        pk: 'id',
                        columns: { id: 'int', author_id: 'int' },
                        relations: {
                            comments: aRelationMeta({
                                kind: InternalRelationKind.HAS_MANY,
                                table: 'comments',
                                sourceKey: 'id',
                                targetKey: 'post_id',
                                targetColumns: { id: 'int', post_id: 'int', body: 'text' },
                                alias: 'comments',
                            }),
                        },
                    },
                }),
            },
        };
        const run = vi.fn(async () => [{ id: 1, email: 'a@a.com', active: true }]);
        const query = vi.fn(async (sql: string) => ({
            rows: sql.includes('comments') ? [] : [{ id: 100, author_id: 1 }],
        }));
        const queryExecutor = aQueryExecutor<Record<string, unknown>>({ meta: nestedMeta, run, query });

        const result = await new ModelQuerySet<Record<string, unknown>>(queryExecutor)
            .prefetchRelated('posts__comments')
            .fetch();

        expect(result.results).toEqual([
            {
                id: 1,
                email: 'a@a.com',
                active: true,
                posts: [{ id: 100, author_id: 1, comments: [] }],
            },
        ]);
        expect(query).toHaveBeenCalledTimes(2);
    });

    it('hydrates prefetch descendants nested under join-backed relations', async () => {
        const joinNestedPrefetchMeta: TableMeta = {
            ...meta,
            relations: {
                team: aRelationMeta({
                    kind: InternalRelationKind.BELONGS_TO,
                    table: 'teams',
                    sourceKey: 'id',
                    targetKey: 'id',
                    targetColumns: { id: 'int', name: 'text' },
                    alias: 'team',
                    targetMeta: {
                        table: 'teams',
                        pk: 'id',
                        columns: { id: 'int', name: 'text' },
                        relations: {
                            posts: aRelationMeta({
                                kind: InternalRelationKind.HAS_MANY,
                                table: 'posts',
                                sourceKey: 'id',
                                targetKey: 'team_id',
                                targetColumns: { id: 'int', team_id: 'int', title: 'text' },
                                alias: 'posts',
                            }),
                        },
                    },
                }),
            },
        };
        const run = vi.fn(async () => [
            {
                id: 1,
                email: 'a@a.com',
                active: true,
                __tango_hydrate_team_id: 10,
                __tango_hydrate_team_name: 'Core',
            },
            {
                id: 2,
                email: 'b@a.com',
                active: false,
                __tango_hydrate_team_id: 10,
                __tango_hydrate_team_name: 'Core',
            },
        ]);
        const query = vi.fn(async () => ({
            rows: [{ id: 100, team_id: 10, title: 'Launch' }],
        }));
        const queryExecutor = aQueryExecutor<Record<string, unknown>>({
            meta: joinNestedPrefetchMeta,
            run,
            query,
        });

        const result = await new ModelQuerySet<Record<string, unknown>>(queryExecutor)
            .prefetchRelated('team__posts')
            .fetch();

        expect(result.results).toEqual([
            {
                id: 1,
                email: 'a@a.com',
                active: true,
                team: {
                    id: 10,
                    name: 'Core',
                    posts: [{ id: 100, team_id: 10, title: 'Launch' }],
                },
            },
            {
                id: 2,
                email: 'b@a.com',
                active: false,
                team: {
                    id: 10,
                    name: 'Core',
                    posts: [{ id: 100, team_id: 10, title: 'Launch' }],
                },
            },
        ]);
        expect(query).toHaveBeenCalledTimes(1);
    });

    it('revalidates compiled prefetch metadata before executing the follow-up query', async () => {
        const run = vi.fn(async (compiled: CompiledQuery) => {
            const prefetch = compiled.hydrationPlan?.prefetchNodes[0];
            if (prefetch) {
                prefetch.targetTable = 'posts; DROP TABLE users;';
            }
            return [{ id: 1, email: 'a@a.com', active: true }];
        });
        const query = vi.fn(async () => ({ rows: [] as Record<string, unknown>[] }));
        const queryExecutor = aQueryExecutor<Record<string, unknown>>({ meta: relatedMeta, run, query });

        await expect(
            new ModelQuerySet<Record<string, unknown>>(queryExecutor).prefetchRelated('posts').fetch()
        ).rejects.toThrow(/failed validation/i);
        expect(query).not.toHaveBeenCalled();
    });

    it('skips prefetch queries when base rows have no groupable source keys', async () => {
        const run = vi.fn(async () => [{ email: 'a@a.com' }]);
        const query = vi.fn(async () => ({ rows: [] as Record<string, unknown>[] }));
        const queryExecutor = aQueryExecutor<Record<string, unknown>>({ meta: relatedMeta, run, query });

        const result = await new ModelQuerySet<Record<string, unknown>>(queryExecutor).prefetchRelated('posts').fetch();

        expect(result.results).toEqual([{ email: 'a@a.com', posts: [] }]);
        expect(query).not.toHaveBeenCalled();
    });

    it('allows a hydrated relation to shadow its own backing foreign key field', async () => {
        const shadowMeta: TableMeta = {
            table: 'posts',
            pk: 'id',
            columns: {
                id: 'int',
                author: 'int',
            },
            relations: {
                author: aRelationMeta({
                    kind: InternalRelationKind.BELONGS_TO,
                    table: 'users',
                    sourceKey: 'author',
                    targetKey: 'id',
                    targetColumns: { id: 'int', email: 'text' },
                    alias: 'author_user',
                }),
            },
        };
        const run = vi.fn(async () => [
            { id: 1, author: 99, __tango_hydrate_author_id: 99, __tango_hydrate_author_email: 'a@a.com' },
        ]);
        const queryExecutor = aQueryExecutor<Record<string, unknown>>({ meta: shadowMeta, run });

        const result = await new ModelQuerySet<Record<string, unknown>>(queryExecutor).selectRelated('author').fetch();

        expect(result.results).toEqual([{ id: 1, author: { id: 99, email: 'a@a.com' } }]);
    });

    it('skips join nodes without compiled join descriptors and no-ops empty prefetch owner batches', async () => {
        const queryExecutor = aQueryExecutor<Record<string, unknown>>({ meta: relatedMeta });
        const querySet = new ModelQuerySet<Record<string, unknown>>(queryExecutor) as unknown as {
            hydrateJoinNodesForOwner: (
                owner: Record<string, unknown>,
                rawRow: Record<string, unknown>,
                nodes: readonly Record<string, unknown>[],
                canonicalEntities: Map<string, Map<string | number, Record<string, unknown>>>
            ) => void;
            hydratePrefetchNode: (
                node: Record<string, unknown>,
                owners: readonly Record<string, unknown>[],
                canonicalEntities: Map<string, Map<string | number, Record<string, unknown>>>,
                compiler: unknown
            ) => Promise<void>;
        };
        const owner = { id: 1 };

        querySet.hydrateJoinNodesForOwner(
            owner,
            { ...owner },
            [
                {
                    relationName: 'team',
                    targetColumns: {},
                },
            ],
            new Map()
        );
        await expect(
            querySet.hydratePrefetchNode(
                {
                    relationName: 'posts',
                    cardinality: 'many',
                    ownerSourceAccessor: 'id',
                },
                [],
                new Map(),
                {}
            )
        ).resolves.toBeUndefined();
        expect(owner).toEqual({ id: 1 });
    });

    it('can attach a private single-valued prefetch node for internal recursion branches', async () => {
        const query = vi.fn(async () => ({
            rows: [
                { id: 10, owner_id: 1, email: 'team@example.com' },
                { id: 11, owner_id: 1, email: 'other@example.com' },
                { id: null, owner_id: 1, email: 'ignored@example.com' },
            ],
        }));
        const queryExecutor = aQueryExecutor<Record<string, unknown>>({ meta: relatedMeta, query });
        const querySet = new ModelQuerySet<Record<string, unknown>>(queryExecutor) as unknown as {
            hydratePrefetchNode: (
                node: Record<string, unknown>,
                owners: readonly Record<string, unknown>[],
                canonicalEntities: Map<string, Map<string | number, Record<string, unknown>>>,
                compiler: {
                    compilePrefetch: () => {
                        kind: typeof InternalPrefetchQueryKind.DIRECT;
                        sql: string;
                        params: readonly unknown[];
                        targetKey: string;
                        targetColumns: Record<string, string>;
                    };
                }
            ) => Promise<void>;
        };
        const owners = [{ id: 1 }] as Record<string, unknown>[];

        await querySet.hydratePrefetchNode(
            {
                relationName: 'profile',
                cardinality: 'single',
                ownerSourceAccessor: 'id',
                targetPrimaryKey: 'id',
                targetModelKey: 'tests/Profile',
                joinChildren: [],
                prefetchChildren: [],
            },
            owners,
            new Map(),
            {
                compilePrefetch: () => ({
                    kind: InternalPrefetchQueryKind.DIRECT,
                    sql: 'SELECT * FROM profiles WHERE owner_id IN ($1)',
                    params: [1],
                    targetKey: 'owner_id',
                    targetColumns: { id: 'int', owner_id: 'int', email: 'text' },
                }),
            }
        );

        expect(owners).toEqual([{ id: 1, profile: { id: 10, owner_id: 1, email: 'team@example.com' } }]);
    });

    it('rejects relation hydration collisions and unsupported hydration paths', async () => {
        const collisionMeta: TableMeta = {
            ...relatedMeta,
            columns: {
                ...relatedMeta.columns,
                team: 'text',
            },
        };
        const manyToManyMeta: TableMeta = {
            ...meta,
            relations: {
                tags: aRelationMeta({
                    kind: InternalRelationKind.MANY_TO_MANY,
                    table: 'tags',
                    sourceKey: 'id',
                    targetKey: 'id',
                    targetColumns: { id: 'int' },
                    alias: 'tags',
                    capabilities: {
                        hydratable: false,
                        joinable: false,
                        prefetchable: false,
                    },
                }),
            },
        };

        await expect(
            new ModelQuerySet<Record<string, unknown>>(aQueryExecutor({ meta: collisionMeta }))
                .selectRelated('team')
                .fetch()
        ).rejects.toThrow(/collides with an existing field/i);
        await expect(
            new ModelQuerySet<Record<string, unknown>>(aQueryExecutor({ meta: manyToManyMeta }))
                .prefetchRelated('tags')
                .fetch()
        ).rejects.toThrow(/cannot be hydrated/i);
        const teamResult = await new ModelQuerySet<Record<string, unknown>>(aQueryExecutor({ meta: relatedMeta }))
            .prefetchRelated('team')
            .fetch();
        expect(teamResult.results).toEqual([]);
    });

    it('can prefetch many-to-many relations and preserves duplicates', async () => {
        const run = vi.fn(async () => [{ id: 1 }]);
        const query = vi.fn(async (sql: string) => {
            if (sql.includes('FROM post_tags')) {
                return {
                    rows: [
                        { __tango_m2m_owner: 1, __tango_m2m_target: 10 },
                        { __tango_m2m_owner: null, __tango_m2m_target: 10 },
                        { __tango_m2m_owner: 2, __tango_m2m_target: 10 },
                        { __tango_m2m_owner: 1, __tango_m2m_target: 10 },
                        { __tango_m2m_owner: 1, __tango_m2m_target: 11 },
                    ],
                };
            }
            if (sql.includes('FROM tags')) {
                return {
                    rows: [
                        { id: 10, name: 'a' },
                        { id: 11, name: 'b' },
                    ],
                };
            }
            if (sql.includes('FROM posts')) {
                return { rows: [] };
            }
            return { rows: [] };
        });
        const m2mMeta: TableMeta = {
            table: 'posts',
            pk: 'id',
            columns: { id: 'int' },
            relations: {
                tags: {
                    edgeId: 'tests/Post:tags',
                    sourceModelKey: 'tests/Post',
                    targetModelKey: 'tests/Tag',
                    kind: InternalRelationKind.MANY_TO_MANY,
                    cardinality: 'many',
                    capabilities: {
                        queryable: true,
                        hydratable: true,
                        joinable: false,
                        prefetchable: true,
                    },
                    table: 'tags',
                    sourceKey: 'id',
                    targetKey: 'id',
                    throughTable: 'post_tags',
                    throughSourceKey: 'post_id',
                    throughTargetKey: 'tag_id',
                    targetPrimaryKey: 'id',
                    targetColumns: { id: 'int', name: 'text' },
                    alias: '__tango_join_posts_tags',
                    targetMeta: {
                        table: 'tags',
                        pk: 'id',
                        columns: { id: 'int', name: 'text' },
                        relations: {
                            posts: {
                                edgeId: 'tests/Tag:posts',
                                sourceModelKey: 'tests/Tag',
                                targetModelKey: 'tests/Post',
                                kind: InternalRelationKind.HAS_MANY,
                                cardinality: 'many',
                                capabilities: {
                                    queryable: true,
                                    hydratable: true,
                                    joinable: false,
                                    prefetchable: true,
                                },
                                table: 'posts',
                                sourceKey: 'id',
                                targetKey: 'tag_id',
                                targetPrimaryKey: 'id',
                                targetColumns: { id: 'int', tag_id: 'int' },
                                alias: '__tango_join_tags_posts',
                                targetMeta: {
                                    table: 'posts',
                                    pk: 'id',
                                    columns: { id: 'int', tag_id: 'int' },
                                },
                            },
                        },
                    },
                },
            },
        };
        const queryExecutor = aQueryExecutor<Record<string, unknown>>({ meta: m2mMeta, run, query });

        const result = await new ModelQuerySet<Record<string, unknown>>(queryExecutor)
            .prefetchRelated('tags__posts')
            .fetch();

        const first = (result.results[0] as Record<string, unknown>).tags as Array<Record<string, unknown>>;
        expect(first.map((tag) => tag.id)).toEqual([10, 10, 11]);
        expect(first[0]).toBe(first[1]);
        expect(query).toHaveBeenCalledWith(expect.stringContaining('FROM posts'), expect.anything());
    });

    it('chunks prefetch owner ids deterministically', async () => {
        const queryExecutor = aQueryExecutor<Record<string, unknown>>({ meta: relatedMeta });
        const querySet = new ModelQuerySet<Record<string, unknown>>(queryExecutor) as unknown as {
            chunkValues: <T>(values: readonly T[], size: number) => T[][];
        };

        expect(querySet.chunkValues([], 2)).toEqual([]);
        expect(querySet.chunkValues([1, 2], 2)).toEqual([[1, 2]]);
        expect(querySet.chunkValues([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
    });

    it('primes the prefetch cache on attached managers when many-to-many rows are hydrated', async () => {
        const run = vi.fn(async () => [{ id: 1 }, { id: 2 }]);
        const query = vi.fn(async (sql: string) => {
            if (sql.includes('FROM post_tags')) {
                return {
                    rows: [
                        { __tango_m2m_owner: 1, __tango_m2m_target: 10 },
                        { __tango_m2m_owner: 1, __tango_m2m_target: 11 },
                    ],
                };
            }
            if (sql.includes('FROM tags')) {
                return {
                    rows: [
                        { id: 10, name: 'a' },
                        { id: 11, name: 'b' },
                    ],
                };
            }
            return { rows: [] };
        });
        const m2mMeta: TableMeta = {
            table: 'posts',
            pk: 'id',
            columns: { id: 'int' },
            relations: {
                tags: {
                    edgeId: 'tests/Post:tags',
                    sourceModelKey: 'tests/Post',
                    targetModelKey: 'tests/Tag',
                    kind: InternalRelationKind.MANY_TO_MANY,
                    cardinality: 'many',
                    capabilities: {
                        queryable: true,
                        hydratable: true,
                        joinable: false,
                        prefetchable: true,
                    },
                    table: 'tags',
                    sourceKey: 'id',
                    targetKey: 'id',
                    throughTable: 'post_tags',
                    throughSourceKey: 'post_id',
                    throughTargetKey: 'tag_id',
                    targetPrimaryKey: 'id',
                    targetColumns: { id: 'int', name: 'text' },
                    alias: '__tango_join_posts_tags',
                    targetMeta: {
                        table: 'tags',
                        pk: 'id',
                        columns: { id: 'int', name: 'text' },
                    },
                },
            },
        };
        const primeCalls: Array<{ ownerId: unknown; rows: readonly Record<string, unknown>[] }> = [];
        const queryExecutor = aQueryExecutor<Record<string, unknown>>({
            meta: m2mMeta,
            run,
            query,
            attachPersistedRecordAccessors: (record) => {
                Object.defineProperty(record, 'tags', {
                    enumerable: false,
                    configurable: true,
                    writable: true,
                    value: {
                        primePrefetchCache: (rows: readonly Record<string, unknown>[]) => {
                            primeCalls.push({ ownerId: record.id, rows });
                        },
                    },
                });
            },
        });

        const result = await new ModelQuerySet<Record<string, unknown>>(queryExecutor).prefetchRelated('tags').fetch();

        expect(primeCalls).toEqual([
            {
                ownerId: 1,
                rows: [
                    { id: 10, name: 'a' },
                    { id: 11, name: 'b' },
                ],
            },
            { ownerId: 2, rows: [] },
        ]);
        const results = result.results as Array<Record<string, unknown>>;
        expect(results[0]!.tags).toBeDefined();
        expect(results[1]!.tags).toBeDefined();
        expect(Object.keys(results[0]!)).toEqual(['id']);
    });

    it('hydrates many-to-many relations as empty when no through pairs exist', async () => {
        const run = vi.fn(async () => [{ id: 1 }]);
        const query = vi.fn(async (sql: string) => {
            if (sql.includes('FROM post_tags')) {
                return { rows: [] };
            }
            if (sql.includes('FROM tags')) {
                return { rows: [{ id: 10, name: 'a' }] };
            }
            return { rows: [] };
        });
        const m2mMeta: TableMeta = {
            table: 'posts',
            pk: 'id',
            columns: { id: 'int' },
            relations: {
                tags: {
                    edgeId: 'tests/Post:tags',
                    sourceModelKey: 'tests/Post',
                    targetModelKey: 'tests/Tag',
                    kind: InternalRelationKind.MANY_TO_MANY,
                    cardinality: 'many',
                    capabilities: {
                        queryable: true,
                        hydratable: true,
                        joinable: false,
                        prefetchable: true,
                    },
                    table: 'tags',
                    sourceKey: 'id',
                    targetKey: 'id',
                    throughTable: 'post_tags',
                    throughSourceKey: 'post_id',
                    throughTargetKey: 'tag_id',
                    targetPrimaryKey: 'id',
                    targetColumns: { id: 'int', name: 'text' },
                    alias: '__tango_join_posts_tags',
                    targetMeta: {
                        table: 'tags',
                        pk: 'id',
                        columns: { id: 'int', name: 'text' },
                    },
                },
            },
        };
        const queryExecutor = aQueryExecutor<Record<string, unknown>>({ meta: m2mMeta, run, query });

        const result = await new ModelQuerySet<Record<string, unknown>>(queryExecutor).prefetchRelated('tags').fetch();
        expect((result.results[0] as Record<string, unknown>).tags).toEqual([]);
        expect(query).toHaveBeenCalledWith(expect.stringContaining('FROM post_tags'), expect.anything());
        expect(query).not.toHaveBeenCalledWith(expect.stringContaining('FROM tags'), expect.anything());
    });

    it('skips many-to-many target rows without a primary key', async () => {
        const run = vi.fn(async () => [{ id: 1 }]);
        const query = vi.fn(async (sql: string) => {
            if (sql.includes('FROM post_tags')) {
                return { rows: [{ __tango_m2m_owner: 1, __tango_m2m_target: 999 }] };
            }
            if (sql.includes('FROM tags')) {
                return { rows: [{ id: null, name: 'a' }] };
            }
            return { rows: [] };
        });
        const m2mMeta: TableMeta = {
            table: 'posts',
            pk: 'id',
            columns: { id: 'int' },
            relations: {
                tags: {
                    edgeId: 'tests/Post:tags',
                    sourceModelKey: 'tests/Post',
                    targetModelKey: 'tests/Tag',
                    kind: InternalRelationKind.MANY_TO_MANY,
                    cardinality: 'many',
                    capabilities: {
                        queryable: true,
                        hydratable: true,
                        joinable: false,
                        prefetchable: true,
                    },
                    table: 'tags',
                    sourceKey: 'id',
                    targetKey: 'id',
                    throughTable: 'post_tags',
                    throughSourceKey: 'post_id',
                    throughTargetKey: 'tag_id',
                    targetPrimaryKey: 'id',
                    targetColumns: { id: 'int', name: 'text' },
                    alias: '__tango_join_posts_tags',
                    targetMeta: {
                        table: 'tags',
                        pk: 'id',
                        columns: { id: 'int', name: 'text' },
                    },
                },
            },
        };
        const queryExecutor = aQueryExecutor<Record<string, unknown>>({ meta: m2mMeta, run, query });

        const result = await new ModelQuerySet<Record<string, unknown>>(queryExecutor).prefetchRelated('tags').fetch();
        expect((result.results[0] as Record<string, unknown>).tags).toEqual([]);
    });

    it('merges duplicate prefetch requests and rejects unknown or invalid eager-loading paths', async () => {
        const run = vi.fn(async () => [{ id: 1, email: 'a@a.com', active: true }]);
        const query = vi.fn(async () => ({ rows: [] as Record<string, unknown>[] }));
        const queryExecutor = aQueryExecutor<Record<string, unknown>>({ meta: relatedMeta, run, query });

        const result = await new ModelQuerySet<Record<string, unknown>>(queryExecutor)
            .prefetchRelated('posts', 'posts')
            .fetch();

        expect(result.results).toEqual([{ id: 1, email: 'a@a.com', active: true, posts: [] }]);
        expect(query).toHaveBeenCalledOnce();
        await expect(
            new ModelQuerySet<Record<string, unknown>>(queryExecutor).selectRelated('missing').fetch()
        ).rejects.toThrow(/unknown relation/i);
        await expect(
            new ModelQuerySet<Record<string, unknown>>(queryExecutor).selectRelated('posts').fetch()
        ).rejects.toThrow(/selectRelated/i);
        await expect(
            new ModelQuerySet<Record<string, unknown>>(queryExecutor).prefetchRelated('team').fetch()
        ).resolves.toBeDefined();
    });

    it('narrows fetched row types from literal select projections', async () => {
        const { queryExecutor } = createQueryExecutorFixture([{ id: 1, email: 'a@a.com', active: true }]);
        const qs = new ModelQuerySet<User>(queryExecutor).select(['id', 'email'] as const);
        const result = await qs.fetch();

        expectTypeOf(qs).toEqualTypeOf<QuerySet<User, Pick<User, 'id' | 'email'>>>();
        expectTypeOf(result.items).toEqualTypeOf<ReadonlyArray<Pick<User, 'id' | 'email'>>>();
    });

    it('resets empty select projections back to the full row type', async () => {
        const { queryExecutor } = createQueryExecutorFixture([{ id: 1, email: 'a@a.com', active: true }]);
        const qs = new ModelQuerySet<User>(queryExecutor).select([]);
        const result = await qs.fetch();

        expectTypeOf(qs).toEqualTypeOf<QuerySet<User>>();
        expectTypeOf(result.items).toEqualTypeOf<ReadonlyArray<User>>();
    });

    it('replaces prior projections when select is called again', async () => {
        const { queryExecutor } = createQueryExecutorFixture([{ id: 1, email: 'a@a.com', active: true }]);
        const qs = new ModelQuerySet<User>(queryExecutor).select(['id'] as const).select(['email'] as const);
        const result = await qs.fetch();

        expectTypeOf(qs).toEqualTypeOf<QuerySet<User, Pick<User, 'email'>>>();
        expectTypeOf(result.items).toEqualTypeOf<ReadonlyArray<Pick<User, 'email'>>>();
    });

    it('types one-level relation hydration from field-authored relation metadata', () => {
        const postExecutor = aQueryExecutor<TypedPostRow>();
        const userExecutor = aQueryExecutor<TypedUserRow>();

        const forward = new ModelQuerySet<TypedPostRow, TypedPostRow, typeof TypedPostModel>(
            postExecutor
        ).selectRelated('author');

        const projected = new ModelQuerySet<TypedPostRow, TypedPostRow, typeof TypedPostModel>(postExecutor)
            .select(['id'] as const)
            .selectRelated('author')
            .select(['title'] as const);

        const reverseSingle = new ModelQuerySet<TypedUserRow, TypedUserRow, typeof TypedUserModel>(
            userExecutor
        ).selectRelated<typeof TypedProfileModel>('profile');

        const reverseMany = new ModelQuerySet<TypedUserRow, TypedUserRow, typeof TypedUserModel>(
            userExecutor
        ).prefetchRelated<typeof TypedPostModel>('posts');

        type ForwardRow = QuerySetRows<typeof forward>[number];
        type ProjectedRow = QuerySetRows<typeof projected>[number];
        type ReverseSingleRow = QuerySetRows<typeof reverseSingle>[number];
        type ReverseManyRow = QuerySetRows<typeof reverseMany>[number];

        expectTypeOf<ForwardRow['author']>().toEqualTypeOf<TypedUserRow | null>();
        expectTypeOf<ProjectedRow['title']>().toEqualTypeOf<string>();
        expectTypeOf<ProjectedRow['author']>().toEqualTypeOf<TypedUserRow | null>();
        // @ts-expect-error repeated select calls replace the base projection.
        type _ProjectedId = ProjectedRow['id'];
        expectTypeOf<ReverseSingleRow['profile']>().toMatchTypeOf<TypedProfileRow | null>();
        expectTypeOf<ReverseManyRow['posts']>().toMatchTypeOf<TypedPostRow[]>();

        const reverseManyFromGenerated = new ModelQuerySet<TypedUserRow, TypedUserRow, typeof TypedUserModel>(
            userExecutor
        ).prefetchRelated('posts');
        // This is still a compile-time assertion, not a runtime noop: it
        // proves the generated-registry branch exposes the same post-row
        // contract that callers already get from the explicit reverse-generic
        // fallback above.
        expectTypeOf<
            QuerySetRows<typeof reverseManyFromGenerated>[number]['posts'][number]
        >().toMatchTypeOf<TypedPostRow>();

        new ModelQuerySet<TypedUserRow, TypedUserRow, typeof TypedUserModel>(userExecutor).prefetchRelated<
            typeof UnrelatedModel
        >('posts');
        new ModelQuerySet<TypedUserRow, TypedUserRow, typeof TypedUserModel>(userExecutor).selectRelated<
            typeof TypedPostModel
            // @ts-expect-error collection relations cannot be loaded through selectRelated.
        >('posts');
        new ModelQuerySet<TypedUserRow, TypedUserRow, typeof TypedUserModel>(userExecutor).prefetchRelated<
            typeof TypedProfileModel
            // @ts-expect-error single relations cannot be loaded through prefetchRelated.
        >('profile');
    });

    it('types nested generated relation paths without explicit reverse generics', () => {
        const userExecutor = aQueryExecutor<TypedUserRow>();

        const nestedSingle = new ModelQuerySet<TypedUserRow, TypedUserRow, typeof TypedUserModel>(
            userExecutor
        ).selectRelated('profile__user');
        const nestedMany = new ModelQuerySet<TypedUserRow, TypedUserRow, typeof TypedUserModel>(
            userExecutor
        ).prefetchRelated('posts__author');

        type NestedSingleRow = QuerySetRows<typeof nestedSingle>[number];
        type NestedManyRow = QuerySetRows<typeof nestedMany>[number];

        expectTypeOf<NestedSingleRow['profile']>().toMatchTypeOf<HydratedQueryResult<
            TypedProfileRow,
            { user: TypedUserRow | null }
        > | null>();
        expectTypeOf<NonNullable<NestedSingleRow['profile']>['user']>().toEqualTypeOf<TypedUserRow | null>();
        expectTypeOf<NestedManyRow['posts']>().toMatchTypeOf<
            Array<HydratedQueryResult<TypedPostRow, { author: TypedUserRow | null }>>
        >();
        expectTypeOf<NestedManyRow['posts'][number]['author']>().toEqualTypeOf<TypedUserRow | null>();
    });

    it('falls back to the full row type for widened but key-safe select arrays', async () => {
        const cols: ReadonlyArray<keyof User> = ['id', 'email'];
        const { queryExecutor } = createQueryExecutorFixture([{ id: 1, email: 'a@a.com', active: true }]);
        const qs = new ModelQuerySet<User>(queryExecutor).select(cols);
        const result = await qs.fetch();

        expectTypeOf(qs).toEqualTypeOf<QuerySet<User>>();
        expectTypeOf(result.items).toEqualTypeOf<ReadonlyArray<User>>();
    });

    it('rejects non-key select arrays at compile time', () => {
        const cols = ['id', 'email'] as string[];
        const qs = new ModelQuerySet<User>(createQueryExecutorFixture().queryExecutor);

        // @ts-expect-error select only accepts keys from the model row
        qs.select(cols);
    });

    it('surfaces a meaningful compile error when a projected queryset is widened back to QuerySet<TModel>', () => {
        const projected = new ModelQuerySet<User>(createQueryExecutorFixture().queryExecutor).select(['id'] as const);

        // @ts-expect-error projected querysets no longer satisfy QuerySet<TModel>
        const widened: QuerySet<User> = projected;

        expect(projected).toBeTruthy();
        void widened;
    });

    it('merges filters when chaining filter twice', async () => {
        const { queryExecutor, run } = createQueryExecutorFixture([{ id: 9, email: 'merge@a.com', active: true }]);
        const qs = new ModelQuerySet<User>(queryExecutor).filter({ active: true }).filter({ email: 'merge@a.com' });
        await qs.fetch();
        const sql = run.mock.calls[0]?.[0]?.sql ?? '';
        expect(sql).toContain('AND');
    });

    it('accepts QNode filters and supports shape function/object in fetch', async () => {
        const { queryExecutor } = createQueryExecutorFixture([{ id: 2, email: 'b@a.com', active: false }]);
        const qs = new ModelQuerySet<User>(queryExecutor)
            .filter(Q.or<User>({ id: 2 }, { email: 'x@x.com' }))
            .exclude(Q.not<User>({ email: 'blocked@example.com' }));

        const byFunction = await qs.fetch((row) => row.email);
        const byParser = await qs.fetch({ parse: (row) => ({ id: row.id }) });

        expect(byFunction.results).toEqual(['b@a.com']);
        expect(byParser.results).toEqual([{ id: 2 }]);
    });

    it('accepts wrapper-forwarded optional shape unions', async () => {
        const { queryExecutor } = createQueryExecutorFixture([{ id: 2, email: 'b@a.com', active: false }]);
        const qs = new ModelQuerySet<User>(queryExecutor);
        const shape: ((row: User) => string) | { parse: (row: User) => { id: number } } | undefined =
            Math.random() > 0.5 ? (row) => row.email : undefined;

        const fetched = await qs.fetch(shape);
        const fetchedOne = await qs.fetchOne(shape);

        const fetchedResults: ReadonlyArray<User | string | { id: number }> = fetched.items;
        const fetchedOneResult: User | string | { id: number } | null = fetchedOne;
        expect(fetchedResults).toHaveLength(1);
        expect(fetchedOneResult).toBeTruthy();
    });

    it('preserves narrowed result types when filtering and ordering after select', async () => {
        const { queryExecutor } = createQueryExecutorFixture([{ id: 2, email: 'b@a.com', active: false }]);
        const qs = new ModelQuerySet<User>(queryExecutor)
            .select(['id'] as const)
            .filter({ email: 'b@a.com' })
            .orderBy('-email')
            .limit(1)
            .offset(0);
        const result = await qs.fetch();

        expectTypeOf(qs).toEqualTypeOf<QuerySet<User, Pick<User, 'id'>>>();
        expectTypeOf(result.items).toEqualTypeOf<ReadonlyArray<Pick<User, 'id'>>>();
    });

    it('returns first row or null in fetchOne', async () => {
        const firstQueryExecutor = createQueryExecutorFixture([
            { id: 1, email: 'first@a.com', active: true },
        ]).queryExecutor;
        const emptyQueryExecutor = createQueryExecutorFixture([]).queryExecutor;

        expect(await new ModelQuerySet<User>(firstQueryExecutor).fetchOne()).toEqual({
            id: 1,
            email: 'first@a.com',
            active: true,
        });
        expect(await new ModelQuerySet<User>(emptyQueryExecutor).fetchOne()).toBeNull();
    });

    it('supports async iteration by materializing the queryset once and yielding each row', async () => {
        const { queryExecutor, run } = createQueryExecutorFixture([
            { id: 1, email: 'iter-1@a.com', active: true },
            { id: 2, email: 'iter-2@a.com', active: false },
        ]);

        const rows: User[] = [];
        for await (const row of new ModelQuerySet<User>(queryExecutor)) {
            rows.push(row);
        }

        expect(rows).toEqual([
            { id: 1, email: 'iter-1@a.com', active: true },
            { id: 2, email: 'iter-2@a.com', active: false },
        ]);
        expect(run).toHaveBeenCalledOnce();
    });

    it('returns first() values with function and parser shapes', async () => {
        const { queryExecutor } = createQueryExecutorFixture([{ id: 1, email: 'first@a.com', active: true }]);
        const qs = new ModelQuerySet<User>(queryExecutor);
        const parser = { parse: vi.fn((row: User) => ({ id: row.id })) };

        expect(await qs.first((row) => row.email)).toBe('first@a.com');
        expect(await qs.first(parser)).toEqual({ id: 1 });
        expect(parser.parse).toHaveBeenCalledWith({ id: 1, email: 'first@a.com', active: true });
    });

    it('falls back to the hydrated row when parser-shape normalization yields no replacement row', async () => {
        const { queryExecutor } = createQueryExecutorFixture(
            [{ id: 9, email: 'fallback@a.com', active: true }],
            'sqlite'
        );
        const qs = new ModelQuerySet<User>(queryExecutor);
        const parser = { parse: vi.fn((row: User) => ({ id: row.id, email: row.email })) };

        (
            qs as unknown as {
                normalizeHydratedRowsForParserShape: (rows: readonly User[]) => Array<User>;
            }
        ).normalizeHydratedRowsForParserShape = vi.fn(() => []);

        expect(await qs.first(parser)).toEqual({ id: 9, email: 'fallback@a.com' });
        expect(parser.parse).toHaveBeenCalledWith({ id: 9, email: 'fallback@a.com', active: true });
    });

    it('uses the original row when shapeFetchedRow cannot read a normalized parser row', () => {
        const { queryExecutor } = createQueryExecutorFixture(
            [{ id: 10, email: 'direct@a.com', active: true }],
            'sqlite'
        );
        const qs = new ModelQuerySet<User>(queryExecutor);
        const parser = { parse: vi.fn((row: User) => row.email) };

        (
            qs as unknown as {
                normalizeHydratedRowsForParserShape: (rows: readonly User[]) => Array<User>;
                shapeFetchedRow: (row: User, shape: typeof parser) => string;
            }
        ).normalizeHydratedRowsForParserShape = vi.fn(() => []);

        const shaped = (
            qs as unknown as { shapeFetchedRow: (row: User, shape: typeof parser) => string }
        ).shapeFetchedRow({ id: 10, email: 'direct@a.com', active: true }, parser);

        expect(shaped).toBe('direct@a.com');
        expect(parser.parse).toHaveBeenCalledWith({ id: 10, email: 'direct@a.com', active: true });
    });

    it('returns last() from the current page when limit or offset are already applied', async () => {
        const { queryExecutor, run } = createQueryExecutorFixture([
            { id: 1, email: 'first@a.com', active: true },
            { id: 3, email: 'last@a.com', active: false },
        ]);

        const qs = new ModelQuerySet<User>(queryExecutor).limit(2);
        const parser = { parse: vi.fn((row: User) => ({ id: row.id })) };

        expect(await qs.last()).toEqual({ id: 3, email: 'last@a.com', active: false });
        expect(await qs.last((row) => row.email)).toBe('last@a.com');
        expect(await qs.last(parser)).toEqual({ id: 3 });
        expect(parser.parse).toHaveBeenCalledWith({ id: 3, email: 'last@a.com', active: false });
        expect(run).toHaveBeenCalledOnce();
    });

    it('returns null from last() when the current page is empty', async () => {
        const { queryExecutor } = createQueryExecutorFixture([]);

        await expect(new ModelQuerySet<User>(queryExecutor).offset(10).last()).resolves.toBeNull();
    });

    it('reverses ordering in last() and falls back to descending primary key order', async () => {
        const ordered = createQueryExecutorFixture([{ id: 1, email: 'ordered@a.com', active: true }]);
        const unordered = createQueryExecutorFixture([{ id: 2, email: 'unordered@a.com', active: false }]);

        await new ModelQuerySet<User>(ordered.queryExecutor).orderBy('email', '-id').last();
        await new ModelQuerySet<User>(unordered.queryExecutor).last();

        const orderedSql = ordered.run.mock.calls[0]?.[0]?.sql ?? '';
        const unorderedSql = unordered.run.mock.calls[0]?.[0]?.sql ?? '';

        expect(orderedSql).toContain('ORDER BY users.email DESC, users.id ASC');
        expect(unorderedSql).toContain('ORDER BY users.id DESC');
        expect(unorderedSql).toContain('LIMIT 1');
    });

    it('narrows fetchOne parser and shape inputs from the selected result type', async () => {
        const { queryExecutor } = createQueryExecutorFixture([{ id: 1, email: 'first@a.com', active: true }]);
        const selected = new ModelQuerySet<User>(queryExecutor).select(['id'] as const);
        const parser = { parse: vi.fn((row: Pick<User, 'id'>) => row.id) };

        const byFunction = await selected.fetchOne((row) => row.id);
        const byParser = await selected.fetchOne(parser);

        expect(byFunction).toBe(1);
        expect(byParser).toBe(1);
        expect(parser.parse).toHaveBeenCalledWith({ id: 1, email: 'first@a.com', active: true });
    });

    it('counts and checks existence using compiled query params', async () => {
        const { queryExecutor, query } = createQueryExecutorFixture([{ id: 1, email: 'a@a.com', active: true }]);
        const qs = new ModelQuerySet<User>(queryExecutor).filter({ active: true });

        const count = await qs.count();
        const exists = await qs.exists();

        expect(count).toBe(1);
        expect(exists).toBe(true);
        expect(query).toHaveBeenCalledTimes(2);
        expect(query.mock.calls[0]?.[0]).toContain('SELECT COUNT(*) as count FROM');
    });

    it('returns false from exists when count is zero', async () => {
        const run = vi.fn(async () => [] as User[]);
        const query = vi.fn(async () => ({ rows: [] as Array<{ count: number }> }));
        const queryExecutor = aQueryExecutor<User>({ meta, query, run });

        const exists = await new ModelQuerySet<User>(queryExecutor).exists();
        expect(exists).toBe(false);
    });

    it('normalizes sqlite bool columns before parser-based schema reads', async () => {
        const { queryExecutor } = createQueryExecutorFixture(
            [{ id: 4, email: 'bool@a.com', active: 1 as unknown as boolean }],
            'sqlite'
        );
        const parser = {
            parse: vi.fn((row: User) => row),
        };
        const result = await new ModelQuerySet<User>(queryExecutor).fetch(parser);
        expect(result.results[0]?.active).toBe(true);
        expect(parser.parse).toHaveBeenCalledWith({ id: 4, email: 'bool@a.com', active: true });
    });

    it('leaves sqlite bool columns untouched for function-shape projections', async () => {
        const { queryExecutor } = createQueryExecutorFixture(
            [{ id: 5, email: 'func@a.com', active: 0 as unknown as boolean }],
            'sqlite'
        );
        const result = await new ModelQuerySet<User>(queryExecutor).fetch((row) => row.active);
        expect(result.results).toEqual([false]);
    });

    it('normalizes sqlite bool zero values to false for parser-based schema reads', async () => {
        const { queryExecutor } = createQueryExecutorFixture(
            [{ id: 6, email: 'zero@a.com', active: 0 as unknown as boolean }],
            'sqlite'
        );
        const parser = {
            parse: vi.fn((row: User) => row),
        };
        const result = await new ModelQuerySet<User>(queryExecutor).fetch(parser);
        expect(result.results[0]?.active).toBe(false);
        expect(parser.parse).toHaveBeenCalledWith({ id: 6, email: 'zero@a.com', active: false });
    });

    it('skips normalization when sqlite repositories have no boolean columns', async () => {
        const run = vi.fn(async () => [{ id: 7, email: 'nobool@a.com', active: 1 as unknown as boolean }]);
        const query = vi.fn(async () => ({ rows: [{ count: 1 }] }));
        const queryExecutor = aQueryExecutor<User>({
            meta: { ...meta, columns: { id: 'int', email: 'text', active: 'int' } },
            dialect: 'sqlite',
            query,
            run,
        });
        const parser = { parse: vi.fn((row: User) => row) };

        const result = await new ModelQuerySet<User>(queryExecutor).fetch(parser);

        expect(result.results[0]?.active).toBe(1);
        expect(parser.parse).toHaveBeenCalledWith({ id: 7, email: 'nobool@a.com', active: 1 });
    });

    it('leaves non 0/1 sqlite bool values unchanged', async () => {
        const { queryExecutor } = createQueryExecutorFixture(
            [{ id: 8, email: 'other@a.com', active: 2 as unknown as boolean }],
            'sqlite'
        );
        const parser = { parse: vi.fn((row: User) => row) };
        const result = await new ModelQuerySet<User>(queryExecutor).fetch(parser);
        expect(result.results[0]?.active).toBe(2);
        expect(parser.parse).toHaveBeenCalledWith({ id: 8, email: 'other@a.com', active: 2 });
    });

    it('skips sqlite boolean normalization for omitted projected columns', async () => {
        const { queryExecutor } = createQueryExecutorFixture([{ id: 10, email: 'skip@a.com' } as User], 'sqlite');
        const parser = {
            parse: vi.fn((row: Pick<User, 'id' | 'email'>) => row),
        };

        const result = await new ModelQuerySet<User>(queryExecutor).select(['id', 'email'] as const).fetch(parser);

        expect(result.results[0]).toEqual({ id: 10, email: 'skip@a.com' });
        expect(parser.parse).toHaveBeenCalledWith({ id: 10, email: 'skip@a.com' });
    });

    it('normalizes multiple sqlite boolean columns in a single row', async () => {
        const run = vi.fn(async () => [
            { id: 9, email: 'multi@a.com', active: 1 as unknown as boolean, verified: 0 as unknown as boolean },
        ]);
        const query = vi.fn(async () => ({ rows: [{ count: 1 }] }));
        const queryExecutor = aQueryExecutor<MultiBoolUser>({
            meta: { ...meta, columns: { ...meta.columns, verified: 'bool' } },
            dialect: 'sqlite',
            query,
            run,
        });
        const parser = { parse: vi.fn((row: MultiBoolUser) => row) };

        const result = await new ModelQuerySet<MultiBoolUser>(queryExecutor).fetch(parser);

        expect(result.results[0]).toEqual({ id: 9, email: 'multi@a.com', active: true, verified: false });
        expect(parser.parse).toHaveBeenCalledWith({ id: 9, email: 'multi@a.com', active: true, verified: false });
    });
});
