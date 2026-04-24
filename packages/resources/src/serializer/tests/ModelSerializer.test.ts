import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import type { ManyToManyRelatedManager, QuerySet } from '@danceroutine/tango-orm';
import { ModelSerializer } from '../ModelSerializer';
import { relation } from '../relation';
import { aManager, aManyToManyRelatedManager, aQueryExecutor, aQueryResult } from '@danceroutine/tango-testing';
import type { ResourceModelLike } from '../../resource/index';

type UserRecord = {
    id: number;
    email: string;
    slug?: string;
};

type TagRecord = {
    id: number;
    slug: string;
    name: string;
};

type TaggedUserRecord = UserRecord & {
    tags: ManyToManyRelatedManager<TagRecord>;
};

const createSchema = z.object({
    email: z.string().email(),
});

const updateSchema = z.object({
    email: z.string().email().optional(),
});

const outputSchema = z.object({
    id: z.number(),
    email: z.string().email(),
    slug: z.string().optional(),
});

const tagSummarySchema = z.object({
    id: z.number(),
    slug: z.string(),
    name: z.string(),
});

const taggedOutputSchema = outputSchema.extend({
    tags: z.array(z.string()),
});

const model: ResourceModelLike<UserRecord> = {
    objects: aManager<UserRecord>({
        meta: { table: 'users', pk: 'id', columns: { id: 'int', email: 'text', slug: 'text' } },
        create: vi.fn(async (input) => ({ id: 1, ...input }) as UserRecord),
        update: vi.fn(async (id, patch) => ({ id: Number(id), email: 'existing@example.com', ...patch }) as UserRecord),
    }),
};

class UserSerializer extends ModelSerializer<
    UserRecord,
    typeof createSchema,
    typeof updateSchema,
    typeof outputSchema
> {
    static readonly model = model;
    static readonly createSchema = createSchema;
    static readonly updateSchema = updateSchema;
    static readonly outputSchema = outputSchema;

    protected override async beforeCreate(data: z.output<typeof createSchema>): Promise<Partial<UserRecord>> {
        return {
            ...data,
            slug: data.email.split('@')[0],
        };
    }

    protected override async beforeUpdate(
        _id: UserRecord[keyof UserRecord],
        data: z.output<typeof updateSchema>
    ): Promise<Partial<UserRecord>> {
        return {
            ...data,
            slug: 'updated-slug',
        };
    }
}

const taggedOutputResolverModel: ResourceModelLike<UserRecord, TaggedUserRecord> = {
    objects: aManager<TaggedUserRecord>({
        meta: { table: 'users', pk: 'id', columns: { id: 'int', email: 'text', slug: 'text' } },
        create: vi.fn(async (input) => {
            const fixture = aManyToManyRelatedManager<TagRecord>({
                targetExecutor: aQueryExecutor<TagRecord>({
                    meta: { table: 'tags', pk: 'id', columns: { id: 'int', slug: 'text', name: 'text' } },
                    run: vi.fn(async () => [{ id: 1, slug: 'staff', name: 'Staff' }]),
                }),
                selectTargetIdsForOwner: async () => [1],
            });
            fixture.manager.primePrefetchCache([{ id: 1, slug: 'staff', name: 'Staff' }]);
            return {
                id: 3,
                ...input,
                tags: fixture.manager,
            } as TaggedUserRecord;
        }),
        update: vi.fn(async (id, patch) => {
            const fixture = aManyToManyRelatedManager<TagRecord>({
                targetExecutor: aQueryExecutor<TagRecord>({
                    meta: { table: 'tags', pk: 'id', columns: { id: 'int', slug: 'text', name: 'text' } },
                    run: vi.fn(async () => [{ id: 1, slug: 'staff', name: 'Staff' }]),
                }),
                selectTargetIdsForOwner: async () => [1],
            });
            fixture.manager.primePrefetchCache([{ id: 1, slug: 'staff', name: 'Staff' }]);
            return {
                id: Number(id),
                email: 'existing@example.com',
                ...patch,
                tags: fixture.manager,
            } as TaggedUserRecord;
        }),
    }),
};

class TaggedUserSerializer extends ModelSerializer<
    UserRecord,
    typeof createSchema,
    typeof updateSchema,
    typeof taggedOutputSchema,
    TaggedUserRecord
> {
    static readonly model = taggedOutputResolverModel;
    static readonly createSchema = createSchema;
    static readonly updateSchema = updateSchema;
    static readonly outputSchema = taggedOutputSchema;
    static readonly outputResolvers = {
        tags: async (record: TaggedUserRecord) => (await record.tags.all().fetch()).results.map((tag) => tag.slug),
    };
}

type TaggableManagerFixture = ReturnType<typeof aManyToManyRelatedManager<TagRecord>> & {
    currentTargets: TagRecord[];
};

function aTaggableManagerFixture(
    initialTargets: readonly TagRecord[],
    resolveTarget: (targetPrimaryKey: unknown) => TagRecord | undefined
): TaggableManagerFixture {
    let currentTargets = [...initialTargets];

    const fixture = aManyToManyRelatedManager<TagRecord>({
        targetExecutor: aQueryExecutor<TagRecord>({
            meta: { table: 'tags', pk: 'id', columns: { id: 'int', slug: 'text', name: 'text' } },
            run: vi.fn(async () => currentTargets),
        }),
        selectTargetIdsForOwner: async () => currentTargets.map((tag) => tag.id),
        insertLink: async (_ownerPrimaryKey, targetPrimaryKey) => {
            const target = resolveTarget(targetPrimaryKey);
            if (target) {
                currentTargets = [...currentTargets, target];
            }
        },
        insertLinks: async (_ownerPrimaryKey, targetPrimaryKeys) => {
            currentTargets = [
                ...currentTargets,
                ...targetPrimaryKeys
                    .map((targetPrimaryKey) => resolveTarget(targetPrimaryKey))
                    .filter((candidate): candidate is TagRecord => !!candidate),
            ];
        },
        deleteLink: async (_ownerPrimaryKey, targetPrimaryKey) => {
            currentTargets = currentTargets.filter((tag) => tag.id !== Number(targetPrimaryKey));
        },
        deleteLinks: async (_ownerPrimaryKey, targetPrimaryKeys) => {
            const toRemove = new Set(targetPrimaryKeys.map(Number));
            currentTargets = currentTargets.filter((tag) => !toRemove.has(tag.id));
        },
    });

    fixture.manager.primePrefetchCache(currentTargets);

    return Object.assign(fixture, {
        get currentTargets() {
            return currentTargets;
        },
    });
}

describe(ModelSerializer, () => {
    it('creates and updates through the model manager', async () => {
        const serializer = new UserSerializer();

        const created = await serializer.create({ email: 'user@example.com' });
        expect(created).toEqual({ id: 1, email: 'user@example.com', slug: 'user' });

        const updated = await serializer.update(1, { email: 'updated@example.com' });
        expect(updated).toEqual({ id: 1, email: 'updated@example.com', slug: 'updated-slug' });
    });

    it('requires a model when subclasses do not override getModel', () => {
        class MissingModelSerializer extends ModelSerializer<
            UserRecord,
            typeof createSchema,
            typeof updateSchema,
            typeof outputSchema
        > {
            static readonly createSchema = createSchema;
            static readonly updateSchema = updateSchema;
            static readonly outputSchema = outputSchema;
        }

        expect(() => new MissingModelSerializer().getModel()).toThrow(
            'MissingModelSerializer must define a static model or override getModel().'
        );
    });

    it('supports a richer model row than the outward serializer contract', async () => {
        const serializer = new TaggedUserSerializer();

        const created = await serializer.create({ email: 'tagged@example.com' });
        expect(created).toEqual({ id: 3, email: 'tagged@example.com', tags: ['staff'] });

        const updated = await serializer.update(3, { email: 'updated-tagged@example.com' });
        expect(updated).toEqual({ id: 3, email: 'updated-tagged@example.com', tags: ['staff'] });
    });

    it('uses relationFields PK-list defaults for many-to-many reads and writes', async () => {
        const availableTags: TagRecord[] = [
            { id: 2, slug: 'staff', name: 'Staff' },
            { id: 3, slug: 'orm', name: 'ORM' },
        ];
        const availableById = new Map(availableTags.map((tag) => [tag.id, tag]));
        const createFixture = aTaggableManagerFixture([], (targetPrimaryKey) =>
            availableById.get(Number(targetPrimaryKey))
        );
        const updateFixture = aTaggableManagerFixture([availableTags[0]!], (targetPrimaryKey) =>
            availableById.get(Number(targetPrimaryKey))
        );

        const relationModel: ResourceModelLike<UserRecord, TaggedUserRecord> = {
            objects: aManager<TaggedUserRecord>({
                meta: {
                    table: 'users',
                    pk: 'id',
                    columns: { id: 'int', email: 'text', slug: 'text' },
                    relations: {
                        tags: {
                            edgeId: 'users:tags',
                            sourceModelKey: 'test/User',
                            targetModelKey: 'test/Tag',
                            kind: 'manyToMany',
                            cardinality: 'many',
                            capabilities: { queryable: true, hydratable: true, joinable: false, prefetchable: true },
                            table: 'tags',
                            sourceKey: 'id',
                            targetKey: 'id',
                            throughTable: 'm2m_tags',
                            throughSourceKey: 'userId',
                            throughTargetKey: 'tagId',
                            targetPrimaryKey: 'id',
                            targetColumns: { id: 'int', slug: 'text', name: 'text' },
                            alias: 'tag_tags',
                        },
                    },
                },
                create: vi.fn(async (input) => ({ id: 11, ...input, tags: createFixture.manager }) as TaggedUserRecord),
                update: vi.fn(
                    async (id, patch) =>
                        ({
                            id: Number(id),
                            email: 'existing@example.com',
                            ...patch,
                            tags: updateFixture.manager,
                        }) as TaggedUserRecord
                ),
            }),
        };

        const relationCreateSchema = z.object({
            email: z.string().email(),
            tags: z.array(z.number().int()).default([]),
        });
        const relationUpdateSchema = relationCreateSchema.partial();
        const relationOutputSchema = outputSchema.extend({
            tags: z.array(z.number()),
        });

        class RelatedUserSerializer extends ModelSerializer<
            UserRecord,
            typeof relationCreateSchema,
            typeof relationUpdateSchema,
            typeof relationOutputSchema,
            TaggedUserRecord
        > {
            static readonly model = relationModel;
            static readonly createSchema = relationCreateSchema;
            static readonly updateSchema = relationUpdateSchema;
            static readonly outputSchema = relationOutputSchema;
            static readonly relationFields = {
                tags: relation.manyToMany(),
            };
        }

        const serializer = new RelatedUserSerializer();

        await expect(serializer.create({ email: 'tags@example.com', tags: [2, 3] })).resolves.toEqual({
            id: 11,
            email: 'tags@example.com',
            tags: [2, 3],
        });
        expect(createFixture.insertLinks).toHaveBeenCalledWith(7, [2, 3], { onDuplicate: 'ignore' });

        await expect(serializer.update(11, { email: 'patched@example.com' })).resolves.toEqual({
            id: 11,
            email: 'patched@example.com',
            tags: [2],
        });
        expect(updateFixture.deleteLink).not.toHaveBeenCalled();
        expect(updateFixture.deleteLinks).not.toHaveBeenCalled();
        expect(updateFixture.insertLink).not.toHaveBeenCalled();
        expect(updateFixture.insertLinks).not.toHaveBeenCalled();
    });

    it('supports nested reads and slug-list writes through relationFields', async () => {
        const existingTags: TagRecord[] = [{ id: 2, slug: 'staff', name: 'Staff' }];
        let nextTagId = 3;
        const createdTargetRows: TagRecord[] = [];
        const availableBySlug = new Map(existingTags.map((tag) => [tag.slug, tag]));
        const availableById = new Map(existingTags.map((tag) => [tag.id, tag]));
        const relationFixture = aTaggableManagerFixture([], (targetPrimaryKey) =>
            availableById.get(Number(targetPrimaryKey))
        );

        const tagQuerySet = {
            filter: vi.fn((where: Record<string, unknown>) => {
                const slugs = (where['slug__in'] as string[]) ?? [];
                return {
                    fetch: vi.fn(async () =>
                        aQueryResult({
                            items: slugs
                                .map((slug) => availableBySlug.get(slug))
                                .filter((candidate): candidate is TagRecord => !!candidate),
                        })
                    ),
                } as Pick<QuerySet<TagRecord>, 'fetch'>;
            }),
        };

        const tagModel: ResourceModelLike<TagRecord, TagRecord> = {
            objects: aManager<TagRecord>({
                meta: { table: 'tags', pk: 'id', columns: { id: 'int', slug: 'text', name: 'text' } },
                query: vi.fn(() => tagQuerySet as unknown as QuerySet<TagRecord>),
                findById: vi.fn(async () => null),
                getOrThrow: vi.fn(async () => {
                    throw new Error('not used');
                }),
                create: vi.fn(async (input: Partial<TagRecord>) => {
                    const created = {
                        id: nextTagId++,
                        slug: String(input.slug),
                        name: String(input.name),
                    };
                    availableBySlug.set(created.slug, created);
                    availableById.set(created.id, created);
                    createdTargetRows.push(created);
                    return created;
                }),
                update: vi.fn(async () => {
                    throw new Error('not used');
                }),
                delete: vi.fn(async () => {}),
                bulkCreate: vi.fn(async () => []),
            }),
        };

        const relationModel: ResourceModelLike<UserRecord, TaggedUserRecord> = {
            objects: aManager<TaggedUserRecord>({
                meta: {
                    table: 'users',
                    pk: 'id',
                    columns: { id: 'int', email: 'text', slug: 'text' },
                    relations: {
                        tags: {
                            edgeId: 'users:tags',
                            sourceModelKey: 'test/User',
                            targetModelKey: 'test/Tag',
                            kind: 'manyToMany',
                            cardinality: 'many',
                            capabilities: { queryable: true, hydratable: true, joinable: false, prefetchable: true },
                            table: 'tags',
                            sourceKey: 'id',
                            targetKey: 'id',
                            throughTable: 'm2m_tags',
                            throughSourceKey: 'userId',
                            throughTargetKey: 'tagId',
                            targetPrimaryKey: 'id',
                            targetColumns: { id: 'int', slug: 'text', name: 'text' },
                            alias: 'tag_tags',
                        },
                    },
                },
                create: vi.fn(
                    async (input) => ({ id: 21, ...input, tags: relationFixture.manager }) as TaggedUserRecord
                ),
            }),
        };

        const relationCreateSchema = z.object({
            email: z.string().email(),
            tags: z.array(z.string()).default([]),
        });
        const relationOutputSchema = outputSchema.extend({
            tags: z.array(tagSummarySchema),
        });

        class SlugRelatedUserSerializer extends ModelSerializer<
            UserRecord,
            typeof relationCreateSchema,
            ReturnType<typeof relationCreateSchema.partial>,
            typeof relationOutputSchema,
            TaggedUserRecord
        > {
            static readonly model = relationModel;
            static readonly createSchema = relationCreateSchema;
            static readonly updateSchema = relationCreateSchema.partial();
            static readonly outputSchema = relationOutputSchema;
            static readonly relationFields = {
                tags: relation.manyToMany({
                    read: relation.nested(tagSummarySchema),
                    write: relation.slugList<TagRecord>({
                        model: tagModel,
                        lookupField: 'slug',
                        createIfMissing: true,
                        buildCreateInput: (slug) => ({ slug, name: slug.toUpperCase() }),
                    }),
                }),
            };
        }

        const serializer = new SlugRelatedUserSerializer();

        await expect(serializer.create({ email: 'nested@example.com', tags: ['staff', 'orm'] })).resolves.toEqual({
            id: 21,
            email: 'nested@example.com',
            tags: [
                { id: 2, slug: 'staff', name: 'Staff' },
                { id: 3, slug: 'orm', name: 'ORM' },
            ],
        });
        expect(createdTargetRows).toEqual([{ id: 3, slug: 'orm', name: 'ORM' }]);
    });

    it('applies many-to-many replacements through the manager set diff instead of clearing shared rows first', async () => {
        const existingTags: TagRecord[] = [
            { id: 2, slug: 'staff', name: 'Staff' },
            { id: 3, slug: 'orm', name: 'ORM' },
        ];
        const availableBySlug = new Map(existingTags.map((tag) => [tag.slug, tag]));
        const availableById = new Map(existingTags.map((tag) => [tag.id, tag]));
        const relationFixture = aTaggableManagerFixture([existingTags[0]!], (targetPrimaryKey) =>
            availableById.get(Number(targetPrimaryKey))
        );

        const tagQuerySet = {
            filter: vi.fn((where: Record<string, unknown>) => {
                const slugs = (where['slug__in'] as string[]) ?? [];
                return {
                    fetch: vi.fn(async () =>
                        aQueryResult({
                            items: slugs
                                .map((slug) => availableBySlug.get(slug))
                                .filter((candidate): candidate is TagRecord => !!candidate),
                        })
                    ),
                } as Pick<QuerySet<TagRecord>, 'fetch'>;
            }),
        };

        const tagModel: ResourceModelLike<TagRecord, TagRecord> = {
            objects: aManager<TagRecord>({
                meta: { table: 'tags', pk: 'id', columns: { id: 'int', slug: 'text', name: 'text' } },
                query: vi.fn(() => tagQuerySet as unknown as QuerySet<TagRecord>),
                create: vi.fn(async () => {
                    throw new Error('not used');
                }),
                update: vi.fn(async () => {
                    throw new Error('not used');
                }),
                delete: vi.fn(async () => {}),
                bulkCreate: vi.fn(async () => []),
            }),
        };

        const relationModel: ResourceModelLike<UserRecord, TaggedUserRecord> = {
            objects: aManager<TaggedUserRecord>({
                meta: {
                    table: 'users',
                    pk: 'id',
                    columns: { id: 'int', email: 'text', slug: 'text' },
                    relations: {
                        tags: {
                            edgeId: 'users:tags',
                            sourceModelKey: 'test/User',
                            targetModelKey: 'test/Tag',
                            kind: 'manyToMany',
                            cardinality: 'many',
                            capabilities: { queryable: true, hydratable: true, joinable: false, prefetchable: true },
                            table: 'tags',
                            sourceKey: 'id',
                            targetKey: 'id',
                            throughTable: 'm2m_tags',
                            throughSourceKey: 'userId',
                            throughTargetKey: 'tagId',
                            targetPrimaryKey: 'id',
                            targetColumns: { id: 'int', slug: 'text', name: 'text' },
                            alias: 'tag_tags',
                        },
                    },
                },
                create: vi.fn(
                    async (input) => ({ id: 41, ...input, tags: relationFixture.manager }) as TaggedUserRecord
                ),
                update: vi.fn(
                    async (id, patch) =>
                        ({
                            id: Number(id),
                            email: 'existing@example.com',
                            ...patch,
                            tags: relationFixture.manager,
                        }) as TaggedUserRecord
                ),
            }),
        };

        const relationCreateSchema = z.object({
            email: z.string().email(),
            tags: z.array(z.string()).default([]),
        });
        const relationUpdateSchema = relationCreateSchema.partial();
        const relationOutputSchema = outputSchema.extend({
            tags: z.array(tagSummarySchema),
        });

        class SlugRelatedUserSerializer extends ModelSerializer<
            UserRecord,
            typeof relationCreateSchema,
            typeof relationUpdateSchema,
            typeof relationOutputSchema,
            TaggedUserRecord
        > {
            static readonly model = relationModel;
            static readonly createSchema = relationCreateSchema;
            static readonly updateSchema = relationUpdateSchema;
            static readonly outputSchema = relationOutputSchema;
            static readonly relationFields = {
                tags: relation.manyToMany({
                    read: relation.nested(tagSummarySchema),
                    write: relation.slugList<TagRecord>({
                        model: tagModel,
                        lookupField: 'slug',
                    }),
                }),
            };
        }

        const serializer = new SlugRelatedUserSerializer();

        await expect(serializer.update(41, { tags: ['staff', 'orm'] })).resolves.toEqual({
            id: 41,
            email: 'existing@example.com',
            tags: [
                { id: 2, slug: 'staff', name: 'Staff' },
                { id: 3, slug: 'orm', name: 'ORM' },
            ],
        });
        expect(relationFixture.deleteLink).not.toHaveBeenCalled();
        expect(relationFixture.deleteLinks).not.toHaveBeenCalled();
        expect(relationFixture.insertLink).toHaveBeenCalledWith(7, 3, { onDuplicate: 'ignore' });
        expect(relationFixture.insertLinks).not.toHaveBeenCalled();
    });

    it('resolves serializer-owned async output fields before parsing the outward schema', async () => {
        const serializer = new TaggedUserSerializer();
        const fixture = aTaggableManagerFixture([{ id: 1, slug: 'staff', name: 'Staff' }], (targetPrimaryKey) =>
            Number(targetPrimaryKey) === 1 ? { id: 1, slug: 'staff', name: 'Staff' } : undefined
        );

        await expect(
            serializer.serialize({
                id: 3,
                email: 'tagged@example.com',
                tags: fixture.manager,
            } satisfies TaggedUserRecord)
        ).resolves.toEqual({
            id: 3,
            email: 'tagged@example.com',
            tags: ['staff'],
        });
    });

    it('exposes defensive no-op and error branches for relation field helpers', async () => {
        const serializer = new TaggedUserSerializer() as unknown as {
            extractRelationWrites: (data: unknown, rawInput: unknown) => Record<string, unknown>;
            applyRelationWrites: (record: TaggedUserRecord, writes: Record<string, unknown>) => Promise<void>;
            syncManyToManyRelation: (record: TaggedUserRecord, fieldName: 'tags', value: unknown) => Promise<void>;
            resolveWriteTargets: (fieldName: 'tags', strategy: unknown, value: unknown) => Promise<readonly unknown[]>;
            getManyToManyManager: (record: TaggedUserRecord, fieldName: string) => ManyToManyRelatedManager<TagRecord>;
            getManyToManyRelationMeta: (fieldName: string) => unknown;
        };
        const fixture = aTaggableManagerFixture([{ id: 1, slug: 'staff', name: 'Staff' }], (targetPrimaryKey) =>
            Number(targetPrimaryKey) === 1 ? { id: 1, slug: 'staff', name: 'Staff' } : undefined
        );
        const record = {
            id: 1,
            email: 'tagged@example.com',
            tags: fixture.manager,
        } satisfies TaggedUserRecord;

        expect(serializer.extractRelationWrites(null, {})).toEqual({});
        expect(serializer.extractRelationWrites({}, null)).toEqual({});

        await expect(serializer.syncManyToManyRelation(record, 'tags', undefined)).resolves.toBeUndefined();
        await expect(serializer.syncManyToManyRelation(record, 'tags', [])).resolves.toBeUndefined();
        await expect(serializer.applyRelationWrites(record, { missing: ['ignored'] })).resolves.toBeUndefined();

        await expect(serializer.resolveWriteTargets('tags', relation.pkList(), 'not-an-array')).rejects.toThrow(
            /primary-key values/i
        );
        await expect(
            serializer.resolveWriteTargets(
                'tags',
                relation.slugList<TagRecord>({
                    model: taggedOutputResolverModel as unknown as ResourceModelLike<TagRecord, TagRecord>,
                    lookupField: 'slug',
                }),
                'not-an-array'
            )
        ).rejects.toThrow(/lookup values/i);
        await expect(
            serializer.resolveWriteTargets(
                'tags',
                relation.slugList<TagRecord>({
                    model: taggedOutputResolverModel as unknown as ResourceModelLike<TagRecord, TagRecord>,
                    lookupField: 'slug',
                }),
                ['   ']
            )
        ).resolves.toEqual([]);

        expect(() =>
            serializer.getManyToManyManager({ id: 1, email: 'bad@example.com', tags: [] } as never, 'tags')
        ).toThrow(/many-to-many related manager/i);
        expect(() => serializer.getManyToManyRelationMeta('missing')).toThrow(/persisted many-to-many edge/i);
    });

    it('supports relation-field edge cases for clearing, default creates, and unresolved slug writes', async () => {
        const availableTags: TagRecord[] = [{ id: 2, slug: 'staff', name: 'Staff' }];
        const availableBySlug = new Map(availableTags.map((tag) => [tag.slug, tag]));
        const availableById = new Map(availableTags.map((tag) => [tag.id, tag]));
        const clearingFixture = aTaggableManagerFixture([availableTags[0]!], (targetPrimaryKey) =>
            availableById.get(Number(targetPrimaryKey))
        );
        const createFixture = aTaggableManagerFixture([], (targetPrimaryKey) =>
            availableById.get(Number(targetPrimaryKey))
        );

        const tagQuerySet = {
            filter: vi.fn((where: Record<string, unknown>) => {
                const slugs = (where['slug__in'] as string[]) ?? [];
                return {
                    fetch: vi.fn(async () =>
                        aQueryResult({
                            items: slugs
                                .map((slug) => availableBySlug.get(slug))
                                .filter((candidate): candidate is TagRecord => !!candidate),
                        })
                    ),
                } as Pick<QuerySet<TagRecord>, 'fetch'>;
            }),
        };

        const tagModel: ResourceModelLike<TagRecord, TagRecord> = {
            objects: aManager<TagRecord>({
                meta: { table: 'tags', pk: 'id', columns: { id: 'int', slug: 'text', name: 'text' } },
                query: vi.fn(() => tagQuerySet as unknown as QuerySet<TagRecord>),
                create: vi.fn(async (input: Partial<TagRecord>) => {
                    const created = {
                        id: 3,
                        slug: String(input.slug),
                        name: String(input.name ?? input.slug),
                    };
                    availableBySlug.set(created.slug, created);
                    availableById.set(created.id, created);
                    return created;
                }),
                update: vi.fn(async () => {
                    throw new Error('not used');
                }),
                delete: vi.fn(async () => {}),
                bulkCreate: vi.fn(async () => []),
            }),
        };

        const relationModel: ResourceModelLike<UserRecord, TaggedUserRecord> = {
            objects: aManager<TaggedUserRecord>({
                meta: {
                    table: 'users',
                    pk: 'id',
                    columns: { id: 'int', email: 'text', slug: 'text' },
                    relations: {
                        tags: {
                            edgeId: 'users:tags',
                            sourceModelKey: 'test/User',
                            targetModelKey: 'test/Tag',
                            kind: 'manyToMany',
                            cardinality: 'many',
                            capabilities: { queryable: true, hydratable: true, joinable: false, prefetchable: true },
                            table: 'tags',
                            sourceKey: 'id',
                            targetKey: 'id',
                            throughTable: 'm2m_tags',
                            throughSourceKey: 'userId',
                            throughTargetKey: 'tagId',
                            targetPrimaryKey: 'id',
                            targetColumns: { id: 'int', slug: 'text', name: 'text' },
                            alias: 'tag_tags',
                        },
                    },
                },
                create: vi.fn(async (input) => ({ id: 31, ...input, tags: createFixture.manager }) as TaggedUserRecord),
                update: vi.fn(
                    async (id, patch) =>
                        ({
                            id: Number(id),
                            email: 'existing@example.com',
                            ...patch,
                            tags: clearingFixture.manager,
                        }) as TaggedUserRecord
                ),
            }),
        };

        const relationCreateSchema = z.object({
            email: z.string().email(),
            tags: z.array(z.string()).default([]),
        });
        const relationUpdateSchema = relationCreateSchema.partial();
        const relationOutputSchema = outputSchema.extend({
            tags: z.array(tagSummarySchema),
        });

        class SlugRelatedUserSerializer extends ModelSerializer<
            UserRecord,
            typeof relationCreateSchema,
            typeof relationUpdateSchema,
            typeof relationOutputSchema,
            TaggedUserRecord
        > {
            static readonly model = relationModel;
            static readonly createSchema = relationCreateSchema;
            static readonly updateSchema = relationUpdateSchema;
            static readonly outputSchema = relationOutputSchema;
            static readonly relationFields = {
                tags: relation.manyToMany({
                    read: relation.nested(tagSummarySchema),
                    write: relation.slugList<TagRecord>({
                        model: tagModel,
                        lookupField: 'slug',
                        createIfMissing: true,
                    }),
                }),
            };
        }

        class StrictSlugSerializer extends SlugRelatedUserSerializer {
            static override readonly relationFields = {
                tags: relation.manyToMany({
                    read: relation.nested(tagSummarySchema),
                    write: relation.slugList<TagRecord>({
                        model: tagModel,
                        lookupField: 'slug',
                        createIfMissing: false,
                    }),
                }),
            };
        }

        const serializer = new SlugRelatedUserSerializer();
        await expect(serializer.update(31, { tags: [] })).resolves.toEqual({
            id: 31,
            email: 'existing@example.com',
            tags: [],
        });
        expect(clearingFixture.deleteLink).toHaveBeenCalledWith(7, 2);
        expect(clearingFixture.deleteLinks).not.toHaveBeenCalled();
        expect(clearingFixture.insertLinks).not.toHaveBeenCalled();

        await expect(serializer.create({ email: 'created@example.com', tags: ['orm'] })).resolves.toEqual({
            id: 31,
            email: 'created@example.com',
            tags: [{ id: 3, slug: 'orm', name: 'orm' }],
        });

        const strictSerializer = new StrictSlugSerializer();
        await expect(strictSerializer.create({ email: 'strict@example.com', tags: ['missing'] })).rejects.toThrow(
            /could not resolve 'missing'/i
        );
    });
});
