import { beforeEach, describe, expect, it } from 'vitest';
import { z } from 'zod';
import { Model, ModelRegistry, t } from '../index';

describe(ModelRegistry, () => {
    beforeEach(() => {
        ModelRegistry.clear();
    });

    it('stores and resolves models through the shared registry', () => {
        const user = Model({
            namespace: 'blog',
            name: 'User',
            table: 'users',
            schema: z.object({ id: t.primaryKey(z.number().int()) }),
        });

        ModelRegistry.clear();
        ModelRegistry.register(user);

        expect(ModelRegistry.get('blog', 'User')).toBe(user);
        expect(ModelRegistry.getByKey('blog/User')).toBe(user);
        expect(ModelRegistry.resolveRef('blog/User')).toBe(user);
        expect(ModelRegistry.resolveRef(user)).toBe(user);
        expect(ModelRegistry.resolveRef(() => user)).toBe(user);
    });

    it('registers many models through the shared registry helper', () => {
        const user = Model({
            namespace: 'blog',
            name: 'User',
            schema: z.object({ id: t.primaryKey(z.number().int()) }),
        });
        const post = Model({
            namespace: 'blog',
            name: 'Post',
            schema: z.object({ id: t.primaryKey(z.number().int()) }),
        });

        ModelRegistry.clear();
        ModelRegistry.registerMany([user, post]);

        expect(ModelRegistry.getByKey(user.metadata.key)).toBe(user);
        expect(ModelRegistry.getByKey(post.metadata.key)).toBe(post);
    });

    it('stores and resolves models through isolated registries', () => {
        const registry = new ModelRegistry();

        const user = Model({
            registry,
            namespace: 'blog',
            name: 'User',
            table: 'users',
            schema: z.object({ id: t.primaryKey(z.number().int()) }),
        });

        expect(registry.getByKey('blog/User')).toBe(user);

        const post = Model({
            registry,
            namespace: 'blog',
            name: 'Post',
            table: 'posts',
            schema: z.object({ id: t.primaryKey(z.number().int()) }),
        });

        expect(registry.get('blog', 'Post')).toBe(post);
        expect(registry.resolveRef('blog/Post')).toBe(post);
    });

    it('registers many models at once on an isolated registry', () => {
        const registry = new ModelRegistry();
        const user = Model({
            registry,
            namespace: 'blog',
            name: 'User',
            schema: z.object({ id: t.primaryKey(z.number().int()) }),
        });
        const post = Model({
            registry,
            namespace: 'blog',
            name: 'Post',
            schema: z.object({ id: t.primaryKey(z.number().int()) }),
        });

        registry.clear();
        registry.registerMany([user, post]);

        expect(registry.getByKey(user.metadata.key)).toBe(user);
        expect(registry.getByKey(post.metadata.key)).toBe(post);
    });

    it('throws for unresolved string references', () => {
        expect(() => ModelRegistry.resolveRef('blog/Unknown')).toThrow(
            "Unable to resolve model reference 'blog/Unknown'"
        );
    });

    it('binds model construction to an active registry context', async () => {
        const registry = new ModelRegistry();

        const user = await ModelRegistry.runWithRegistry(registry, () =>
            Model({
                namespace: 'ctx',
                name: 'User',
                table: 'ctx_users',
                schema: z.object({ id: t.primaryKey(z.number().int()) }),
            })
        );

        expect(ModelRegistry.getOwner(user)).toBe(registry);
        expect(registry.getByKey('ctx/User')).toBe(user);
        expect(ModelRegistry.getByKey('ctx/User')).toBeUndefined();
    });

    it('keeps overlapping active registry contexts isolated', async () => {
        const firstRegistry = new ModelRegistry();
        const secondRegistry = new ModelRegistry();
        let markSecondContextReady!: () => void;
        let releaseSecondContext!: () => void;
        const secondContextReady = new Promise<void>((resolve) => {
            markSecondContextReady = resolve;
        });
        const secondContextReleased = new Promise<void>((resolve) => {
            releaseSecondContext = resolve;
        });

        const firstModelPromise = ModelRegistry.runWithRegistry(firstRegistry, async () => {
            await secondContextReady;
            return Model({
                namespace: 'ctx',
                name: 'First',
                table: 'ctx_first',
                schema: z.object({ id: t.primaryKey(z.number().int()) }),
            });
        });

        const secondModelPromise = ModelRegistry.runWithRegistry(secondRegistry, async () => {
            markSecondContextReady();
            await secondContextReleased;
            return Model({
                namespace: 'ctx',
                name: 'Second',
                table: 'ctx_second',
                schema: z.object({ id: t.primaryKey(z.number().int()) }),
            });
        });

        const firstModel = await firstModelPromise;
        releaseSecondContext();
        const secondModel = await secondModelPromise;

        expect(ModelRegistry.getOwner(firstModel)).toBe(firstRegistry);
        expect(ModelRegistry.getOwner(secondModel)).toBe(secondRegistry);
        expect(firstRegistry.getByKey('ctx/First')).toBe(firstModel);
        expect(secondRegistry.getByKey('ctx/Second')).toBe(secondModel);
        expect(firstRegistry.getByKey('ctx/Second')).toBeUndefined();
        expect(secondRegistry.getByKey('ctx/First')).toBeUndefined();
    });

    it('rejects registration into a registry that does not own the model', () => {
        const owningRegistry = new ModelRegistry();
        const user = Model({
            registry: owningRegistry,
            namespace: 'blog',
            name: 'User',
            schema: z.object({ id: t.primaryKey(z.number().int()) }),
        });

        expect(() => new ModelRegistry().register(user)).toThrow(
            "Model 'blog/User' belongs to a different registry and cannot be registered here."
        );
    });

    it('finalizes storage fields and rejects unknown finalized field lookups', () => {
        const registry = new ModelRegistry();

        const user = Model({
            registry,
            namespace: 'blog',
            name: 'User',
            table: 'users',
            schema: z.object({ id: t.primaryKey(z.number().int()) }),
        });

        expect(registry.getFinalizedFields(user)[0]).toMatchObject({ name: 'id', primaryKey: true });
        expect(() => registry.getFinalizedFields('blog/Unknown')).toThrow(
            "No finalized storage fields are available for model 'blog/Unknown'."
        );
    });

    it('reuses cached storage and relation artifacts while the registry version is unchanged', () => {
        const registry = new ModelRegistry();

        Model({
            registry,
            namespace: 'blog',
            name: 'User',
            schema: z.object({ id: t.primaryKey(z.number().int()) }),
        });

        expect(registry.finalizeStorageArtifacts()).toBe(registry.finalizeStorageArtifacts());
        expect(registry.getResolvedRelationGraph()).toBe(registry.getResolvedRelationGraph());
    });

    it('builds a resolved relation graph with explicit overrides and many-to-many fences', () => {
        const registry = new ModelRegistry();

        const UserModel = Model({
            registry,
            namespace: 'blog',
            name: 'User',
            table: 'users',
            schema: z.object({ id: t.primaryKey(z.number().int()) }),
            relations: (r) => ({
                posts: r.hasMany('blog/Post', 'authorId'),
                profile: r.hasOne('blog/Profile', 'userId'),
            }),
        });

        Model({
            registry,
            namespace: 'blog',
            name: 'Profile',
            table: 'profiles',
            schema: z.object({
                id: t.primaryKey(z.number().int()),
                userId: t.oneToOne(UserModel, { field: z.number().int() }),
            }),
            relations: (r) => ({
                user: r.belongsTo('blog/User', 'userId'),
            }),
        });

        const TagModel = Model({
            registry,
            namespace: 'blog',
            name: 'Tag',
            table: 'tags',
            schema: z.object({ id: t.primaryKey(z.number().int()) }),
        });

        const PostModel = Model({
            registry,
            namespace: 'blog',
            name: 'Post',
            table: 'posts',
            schema: z.object({
                id: t.primaryKey(z.number().int()),
                authorId: t.foreignKey(UserModel, { field: z.number().int() }),
                tags: t.manyToMany(TagModel),
            }),
            relations: (r) => ({
                author: r.belongsTo('blog/User', 'authorId'),
            }),
        });

        const graph = registry.getResolvedRelationGraph();
        const postRelations = graph.byModel.get(PostModel.metadata.key);
        const userRelations = graph.byModel.get(UserModel.metadata.key);

        expect(postRelations?.get('author')).toMatchObject({
            kind: 'belongsTo',
            targetModelKey: 'blog/User',
        });
        expect(postRelations?.get('tags')).toMatchObject({
            kind: 'manyToMany',
            capabilities: {
                migratable: false,
                queryable: false,
                hydratable: false,
            },
        });
        expect(userRelations?.get('posts')).toMatchObject({
            kind: 'hasMany',
            targetModelKey: 'blog/Post',
        });
        expect(userRelations?.get('profile')).toMatchObject({
            kind: 'hasOne',
            targetModelKey: 'blog/Profile',
        });
    });

    it('uses defaultRelatedName for synthesized reverse names', () => {
        const registry = new ModelRegistry();

        const PostModel = Model({
            registry,
            namespace: 'blog',
            name: 'Post',
            table: 'posts',
            defaultRelatedName: 'entries',
            schema: z.object({
                id: t.primaryKey(z.number().int()),
                authorId: t.foreignKey('blog/User', { field: z.number().int() }),
            }),
        });

        Model({
            registry,
            namespace: 'blog',
            name: 'User',
            table: 'users',
            schema: z.object({ id: t.primaryKey(z.number().int()) }),
        });

        const userRelations = registry.getResolvedRelationGraph().byModel.get('blog/User');
        expect(userRelations?.get('entries')).toMatchObject({
            kind: 'hasMany',
            targetModelKey: PostModel.metadata.key,
        });
    });

    it('uses decorator names for forward and reverse edges without explicit relations', () => {
        const registry = new ModelRegistry();

        Model({
            registry,
            namespace: 'blog',
            name: 'User',
            schema: z.object({ id: t.primaryKey(z.number().int()) }),
        });

        const PostModel = Model({
            registry,
            namespace: 'blog',
            name: 'Post',
            schema: z.object({
                id: t.primaryKey(z.number().int()),
                authorId: t.foreignKey('blog/User', {
                    field: z.number().int(),
                    name: 'writer',
                    relatedName: 'articles',
                }),
            }),
        });

        const graph = registry.getResolvedRelationGraph();
        expect(graph.byModel.get(PostModel.metadata.key)?.get('writer')).toMatchObject({
            kind: 'belongsTo',
            alias: 'user_writer',
        });
        expect(graph.byModel.get('blog/User')?.get('articles')).toMatchObject({
            kind: 'hasMany',
            alias: 'post_articles',
        });
    });

    it('lets explicit relation overrides win over decorator-supplied names', () => {
        const registry = new ModelRegistry();

        const UserModel = Model({
            registry,
            namespace: 'blog',
            name: 'User',
            schema: z.object({ id: t.primaryKey(z.number().int()) }),
            relations: (r) => ({
                posts: r.hasMany('blog/Post', 'authorId'),
            }),
        });

        const PostModel = Model({
            registry,
            namespace: 'blog',
            name: 'Post',
            schema: z.object({
                id: t.primaryKey(z.number().int()),
                authorId: t.foreignKey(UserModel, {
                    field: z.number().int(),
                    name: 'writer',
                    relatedName: 'articles',
                }),
            }),
            relations: (r) => ({
                author: r.belongsTo('blog/User', 'authorId'),
            }),
        });

        const graph = registry.getResolvedRelationGraph();
        expect(graph.byModel.get(PostModel.metadata.key)?.has('author')).toBe(true);
        expect(graph.byModel.get(PostModel.metadata.key)?.has('writer')).toBe(false);
        expect(graph.byModel.get(UserModel.metadata.key)?.has('posts')).toBe(true);
        expect(graph.byModel.get(UserModel.metadata.key)?.has('articles')).toBe(false);
    });

    it('lets decorator related names override defaultRelatedName', () => {
        const registry = new ModelRegistry();

        Model({
            registry,
            namespace: 'blog',
            name: 'User',
            schema: z.object({ id: t.primaryKey(z.number().int()) }),
        });

        const PostModel = Model({
            registry,
            namespace: 'blog',
            name: 'Post',
            defaultRelatedName: 'entries',
            schema: z.object({
                id: t.primaryKey(z.number().int()),
                authorId: t.foreignKey('blog/User', {
                    field: z.number().int(),
                    relatedName: 'articles',
                }),
            }),
        });

        const userRelations = registry.getResolvedRelationGraph().byModel.get('blog/User');
        expect(userRelations?.has('entries')).toBe(false);
        expect(userRelations?.get('articles')).toMatchObject({
            kind: 'hasMany',
            targetModelKey: PostModel.metadata.key,
        });
    });

    it('derives plural reverse names for source models ending in y', () => {
        const registry = new ModelRegistry();

        Model({
            registry,
            namespace: 'blog',
            name: 'Category',
            schema: z.object({
                id: t.primaryKey(z.number().int()),
                ownerId: t.foreignKey('blog/User', { field: z.number().int() }),
            }),
        });

        Model({
            registry,
            namespace: 'blog',
            name: 'User',
            schema: z.object({ id: t.primaryKey(z.number().int()) }),
        });

        expect(registry.getResolvedRelationGraph().byModel.get('blog/User')?.get('categories')).toMatchObject({
            kind: 'hasMany',
        });
    });

    it('derives plural reverse names for source models ending in s', () => {
        const registry = new ModelRegistry();

        Model({
            registry,
            namespace: 'blog',
            name: 'Class',
            schema: z.object({
                id: t.primaryKey(z.number().int()),
                teacherId: t.foreignKey('blog/User', { field: z.number().int() }),
            }),
        });

        Model({
            registry,
            namespace: 'blog',
            name: 'User',
            schema: z.object({ id: t.primaryKey(z.number().int()) }),
        });

        expect(registry.getResolvedRelationGraph().byModel.get('blog/User')?.get('classes')).toMatchObject({
            kind: 'hasMany',
        });
    });

    it('derives singular reverse names for unique relations without overrides', () => {
        const registry = new ModelRegistry();

        Model({
            registry,
            namespace: 'blog',
            name: 'Profile',
            schema: z.object({
                id: t.primaryKey(z.number().int()),
                userId: t.oneToOne('blog/User', { field: z.number().int() }),
            }),
        });

        Model({
            registry,
            namespace: 'blog',
            name: 'User',
            schema: z.object({ id: t.primaryKey(z.number().int()) }),
        });

        expect(registry.getResolvedRelationGraph().byModel.get('blog/User')?.get('profile')).toMatchObject({
            kind: 'hasOne',
        });
    });

    it('supports object-form many-to-many names without changing capability fences', () => {
        const registry = new ModelRegistry();

        const TagModel = Model({
            registry,
            namespace: 'blog',
            name: 'Tag',
            schema: z.object({ id: t.primaryKey(z.number().int()) }),
        });

        const PostModel = Model({
            registry,
            namespace: 'blog',
            name: 'Post',
            schema: z.object({
                id: t.primaryKey(z.number().int()),
                tags: t.manyToMany(TagModel, { name: 'labels' }),
            }),
        });

        expect(registry.getResolvedRelationGraph().byModel.get(PostModel.metadata.key)?.get('labels')).toMatchObject({
            kind: 'manyToMany',
            alias: 'post_labels',
            capabilities: {
                migratable: false,
                queryable: false,
                hydratable: false,
            },
        });
    });

    it('matches bare string relation overrides within the source namespace', () => {
        const registry = new ModelRegistry();

        const UserModel = Model({
            registry,
            namespace: 'blog',
            name: 'User',
            schema: z.object({ id: t.primaryKey(z.number().int()) }),
            relations: (r) => ({
                posts: r.hasMany('Post', 'authorId'),
            }),
        });

        const PostModel = Model({
            registry,
            namespace: 'blog',
            name: 'Post',
            schema: z.object({
                id: t.primaryKey(z.number().int()),
                authorId: t.foreignKey(UserModel, { field: z.number().int() }),
            }),
            relations: (r) => ({
                author: r.belongsTo('User', 'authorId'),
            }),
        });

        const graph = registry.getResolvedRelationGraph();
        expect(graph.byModel.get(PostModel.metadata.key)?.get('author')).toMatchObject({
            kind: 'belongsTo',
            targetModelKey: UserModel.metadata.key,
        });
        expect(graph.byModel.get(UserModel.metadata.key)?.get('posts')).toMatchObject({
            kind: 'hasMany',
            targetModelKey: PostModel.metadata.key,
        });
    });

    it('marks reverse relations as relations-api provenance when an explicit override matches', () => {
        const registry = new ModelRegistry();

        const UserModel = Model({
            registry,
            namespace: 'blog',
            name: 'User',
            schema: z.object({ id: t.primaryKey(z.number().int()) }),
            relations: (r) => ({
                profile: r.hasOne('blog/Profile', 'userId'),
            }),
        });

        Model({
            registry,
            namespace: 'blog',
            name: 'Profile',
            schema: z.object({
                id: t.primaryKey(z.number().int()),
                userId: t.oneToOne(UserModel, { field: z.number().int() }),
            }),
        });

        expect(registry.getResolvedRelationGraph().byModel.get(UserModel.metadata.key)?.get('profile')).toMatchObject({
            kind: 'hasOne',
            provenance: 'relations-api',
        });
    });

    it('lets explicit field metadata override selected inferred fields', () => {
        const registry = new ModelRegistry();
        const UserModel = Model({
            registry,
            namespace: 'blog',
            name: 'User',
            fields: [{ name: 'email_address', type: 'text', notNull: true }],
            schema: z.object({
                id: t.primaryKey(z.number().int()),
                email: t.dbColumn(z.string().email(), 'email_address'),
            }),
        });

        const PostModel = Model({
            registry,
            namespace: 'blog',
            name: 'Post',
            schema: z.object({
                id: t.primaryKey(z.number().int()),
                authorId: t.foreignKey(UserModel, { field: z.number().int() }),
            }),
        });

        expect(registry.finalizeStorageArtifacts().byModel.get(UserModel.metadata.key)?.fields).toEqual([
            {
                name: 'id',
                type: 'int',
                notNull: true,
                default: undefined,
                primaryKey: true,
            },
            {
                name: 'email_address',
                type: 'text',
                notNull: true,
            },
        ]);
        expect(registry.getResolvedRelationGraph().byModel.get(PostModel.metadata.key)?.get('author')).toMatchObject({
            targetFieldName: 'id',
        });
    });

    it('rejects ambiguous reverse names without explicit overrides', () => {
        const registry = new ModelRegistry();

        const UserModel = Model({
            registry,
            namespace: 'blog',
            name: 'User',
            table: 'users',
            schema: z.object({ id: t.primaryKey(z.number().int()) }),
        });

        Model({
            registry,
            namespace: 'blog',
            name: 'Article',
            table: 'articles',
            schema: z.object({
                id: t.primaryKey(z.number().int()),
                authorId: t.foreignKey(UserModel, { field: z.number().int() }),
                editorId: t.foreignKey(UserModel, { field: z.number().int() }),
            }),
        });

        expect(() => registry.getResolvedRelationGraph()).toThrow(
            "Ambiguous relation name 'articles' on model 'blog/User'"
        );
    });

    it('rejects duplicate decorator forward names on the same source model', () => {
        const registry = new ModelRegistry();

        Model({
            registry,
            namespace: 'blog',
            name: 'User',
            schema: z.object({ id: t.primaryKey(z.number().int()) }),
        });

        Model({
            registry,
            namespace: 'blog',
            name: 'Post',
            schema: z.object({
                id: t.primaryKey(z.number().int()),
                authorId: t.foreignKey('blog/User', {
                    field: z.number().int(),
                    name: 'writer',
                }),
                editorId: t.foreignKey('blog/User', {
                    field: z.number().int(),
                    name: 'writer',
                }),
            }),
        });

        expect(() => registry.getResolvedRelationGraph()).toThrow(
            "Ambiguous relation name 'writer' on model 'blog/Post'"
        );
    });

    it('rejects duplicate decorator reverse names on the same target model', () => {
        const registry = new ModelRegistry();

        Model({
            registry,
            namespace: 'blog',
            name: 'User',
            schema: z.object({ id: t.primaryKey(z.number().int()) }),
        });

        Model({
            registry,
            namespace: 'blog',
            name: 'Post',
            schema: z.object({
                id: t.primaryKey(z.number().int()),
                authorId: t.foreignKey('blog/User', {
                    field: z.number().int(),
                    relatedName: 'articles',
                }),
                editorId: t.foreignKey('blog/User', {
                    field: z.number().int(),
                    relatedName: 'articles',
                }),
            }),
        });

        expect(() => registry.getResolvedRelationGraph()).toThrow(
            "Ambiguous relation name 'articles' on model 'blog/User'"
        );
    });

    it('rejects relation overrides that do not match a field-authored relation', () => {
        const registry = new ModelRegistry();

        Model({
            registry,
            namespace: 'blog',
            name: 'User',
            table: 'users',
            schema: z.object({ id: t.primaryKey(z.number().int()) }),
            relations: (r) => ({
                posts: r.hasMany('blog/Post', 'authorId'),
            }),
        });

        expect(() => registry.getResolvedRelationGraph()).toThrow(
            "Relation override 'posts' on model 'blog/User' does not match a field-authored relation."
        );
    });

    it('rejects direct references that belong to a different registry', () => {
        const globalUser = Model({
            namespace: 'global',
            name: 'User',
            table: 'users',
            schema: z.object({ id: t.primaryKey(z.number().int()) }),
        });

        const isolatedRegistry = new ModelRegistry();
        const commentModel = Model({
            registry: isolatedRegistry,
            namespace: 'isolated',
            name: 'Comment',
            table: 'comments',
            schema: z.object({
                id: t.primaryKey(z.number().int()),
                authorId: t.foreignKey(globalUser, { field: z.number().int() }),
            }),
        });

        expect(() => commentModel.metadata.fields).toThrow(
            `Model reference '${globalUser.metadata.key}' belongs to a different registry and cannot be resolved here.`
        );
    });

    it('rejects duplicate model keys in a single registry', () => {
        const registry = new ModelRegistry();

        Model({
            registry,
            namespace: 'blog',
            name: 'User',
            table: 'users',
            schema: z.object({ id: t.primaryKey(z.number().int()) }),
        });

        expect(() =>
            Model({
                registry,
                namespace: 'blog',
                name: 'User',
                table: 'users_v2',
                schema: z.object({ id: t.primaryKey(z.number().int()) }),
            })
        ).toThrow("Model 'blog/User' is already registered in this registry.");
    });
});
