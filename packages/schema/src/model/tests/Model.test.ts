import { beforeEach, describe, it, expect } from 'vitest';
import { z } from 'zod';
import { Model, ModelRegistry, t } from '../index';
import type { PersistedModelOutput } from '../../domain';
import { InternalFieldType } from '../../domain/internal/InternalFieldType';

describe(Model, () => {
    beforeEach(() => {
        ModelRegistry.clear();
    });

    it('creates model with explicit fields', () => {
        const schema = z.object({
            id: z.number().int(),
            name: z.string(),
        });

        const result = Model({
            namespace: 'test',
            name: 'User',
            table: 'users',
            schema,
            fields: [
                { name: 'id', type: InternalFieldType.SERIAL, primaryKey: true },
                { name: 'name', type: InternalFieldType.TEXT, notNull: true },
            ],
        });

        expect(result.metadata.table).toBe('users');
        expect(result.metadata.key).toBe('test/User');
        expect(result.metadata.fields).toHaveLength(2);
        expect(result.metadata.fields[0]).toEqual({
            name: 'id',
            type: 'serial',
            primaryKey: true,
        });
        expect(result.schema).toBe(schema);
    });

    it('infers fields from Zod schema', () => {
        const schema = z.object({
            id: z.number().int(),
            email: z.string(),
            isActive: z.boolean(),
            createdAt: z.date(),
        });

        const result = Model({
            namespace: 'test',
            name: 'User',
            table: 'users',
            schema,
        });

        expect(result.metadata.fields).toHaveLength(4);
        expect(result.metadata.fields[0]).toMatchObject({
            name: 'id',
            type: 'int',
            notNull: true,
        });
        expect(result.metadata.fields[1]).toMatchObject({
            name: 'email',
            type: 'text',
            notNull: true,
        });
        expect(result.metadata.fields[2]).toMatchObject({
            name: 'isActive',
            type: 'bool',
            notNull: true,
        });
        expect(result.metadata.fields[3]).toMatchObject({
            name: 'createdAt',
            type: 'timestamptz',
            notNull: true,
        });
    });

    it('handles optional fields', () => {
        const schema = z.object({
            name: z.string().optional(),
            age: z.number().int().nullable(),
        });

        const result = Model({
            namespace: 'test',
            name: 'User',
            table: 'users',
            schema,
        });

        expect(result.metadata.fields[0]).toMatchObject({
            name: 'name',
            type: 'text',
            notNull: false,
        });
        expect(result.metadata.fields[1]).toMatchObject({
            name: 'age',
            type: 'int',
            notNull: false,
        });
    });

    it('handles default values', () => {
        const schema = z.object({
            status: z.string().default('active'),
            count: z.number().int().default(0),
            createdAt: z.date().default(() => new Date()),
        });

        const result = Model({
            namespace: 'test',
            name: 'Item',
            table: 'items',
            schema,
        });

        expect(result.metadata.fields[0]).toMatchObject({
            name: 'status',
            type: 'text',
            default: 'active',
        });
        expect(result.metadata.fields[1]).toMatchObject({
            name: 'count',
            type: 'int',
            default: '0',
        });
        expect(result.metadata.fields[2]).toMatchObject({
            name: 'createdAt',
            type: 'timestamptz',
            default: { now: true },
        });
    });

    it('adds indexes', () => {
        const schema = z.object({
            id: z.number().int(),
            email: z.string(),
        });

        const result = Model({
            namespace: 'test',
            name: 'User',
            table: 'users',
            schema,
            indexes: [
                { name: 'users_email_idx', on: ['email'], unique: true },
                { name: 'users_created_idx', on: ['createdAt', 'id'] },
            ],
        });

        expect(result.metadata.indexes).toHaveLength(2);
        expect(result.metadata.indexes?.[0]).toEqual({
            name: 'users_email_idx',
            on: ['email'],
            unique: true,
        });
    });

    it('adds relations', () => {
        const schema = z.object({
            id: z.number().int(),
            teamId: z.number().int().nullable(),
        });

        const result = Model({
            namespace: 'test',
            name: 'User',
            table: 'users',
            schema,
            relations: (r) => ({
                team: r.belongsTo('Team', 'teamId'),
                posts: r.hasMany('Post', 'authorId'),
                profile: r.hasOne('Profile', 'userId'),
            }),
        });

        expect(result.metadata.relations).toBeDefined();
        expect(result.metadata.relations?.team).toEqual({
            type: 'belongsTo',
            target: 'Team',
            foreignKey: 'teamId',
        });
        expect(result.metadata.relations?.posts).toEqual({
            type: 'hasMany',
            target: 'Post',
            foreignKey: 'authorId',
        });
        expect(result.metadata.relations?.profile).toEqual({
            type: 'hasOne',
            target: 'Profile',
            foreignKey: 'userId',
        });
    });

    it('throws when namespace or name is empty', () => {
        const schema = z.object({ id: z.number().int() });

        expect(() =>
            Model({
                namespace: '',
                name: 'User',
                table: 'users',
                schema,
            })
        ).toThrow('Model.namespace is required');

        expect(() =>
            Model({
                namespace: 'test',
                name: '',
                table: 'users',
                schema,
            })
        ).toThrow('Model.name is required');
    });

    it('derives table name from model name when table is omitted', () => {
        const schema = z.object({
            id: z.number().int(),
        });

        const commentModel = Model({
            namespace: 'blog',
            name: 'Comment',
            schema,
        });

        const blogPostModel = Model({
            namespace: 'blog',
            name: 'BlogPost',
            schema,
        });

        const categoryModel = Model({
            namespace: 'blog',
            name: 'Category',
            schema,
        });
        const classModel = Model({
            namespace: 'blog',
            name: 'Class',
            schema,
        });

        expect(commentModel.metadata.table).toBe('comments');
        expect(blogPostModel.metadata.table).toBe('blog_posts');
        expect(categoryModel.metadata.table).toBe('categories');
        expect(classModel.metadata.table).toBe('classes');
    });

    it('keeps explicit table override when provided', () => {
        const schema = z.object({
            id: z.number().int(),
        });

        const result = Model({
            namespace: 'blog',
            name: 'Comment',
            table: 'legacy_comment_table',
            schema,
        });

        expect(result.metadata.table).toBe('legacy_comment_table');
    });

    it('preserves model write hooks outside structural metadata', () => {
        const schema = z.object({
            id: z.number().int(),
            email: z.string().email(),
        });

        const result = Model({
            namespace: 'blog',
            name: 'User',
            schema,
            hooks: {
                async beforeCreate({ data }) {
                    return {
                        ...data,
                        email: data.email?.toLowerCase(),
                    };
                },
            },
        });

        expect(result.hooks?.beforeCreate).toBeTypeOf('function');
        expect('hooks' in result.metadata).toBe(false);
    });

    it('does not omit opaque persisted fields when filtering many-to-many relation fields from row output', () => {
        const UserModel = Model({
            namespace: 'blog',
            name: 'User',
            schema: z.object({
                id: t.primaryKey(z.number().int()),
            }),
        });
        const TagModel = Model({
            namespace: 'blog',
            name: 'Tag',
            schema: z.object({
                id: t.primaryKey(z.number().int()),
            }),
        });
        const opaqueForeignKey = t.foreignKey(UserModel, { field: z.number().int() }) as ReturnType<typeof JSON.parse>;
        const schema = z.object({
            id: t.primaryKey(z.number().int()),
            authorId: opaqueForeignKey,
        });
        const manyToManySchema = z.object({
            tags: t.manyToMany(TagModel),
        });
        type Row = PersistedModelOutput<typeof schema>;
        type ManyToManyRow = PersistedModelOutput<typeof manyToManySchema>;

        const row = {} as Row;
        void row.authorId;
        const manyToManyRow = {} as ManyToManyRow;
        // @ts-expect-error many-to-many fields are relation storage, not persisted row fields.
        void manyToManyRow.tags;
    });

    it('throws when table is provided as empty string', () => {
        const schema = z.object({
            id: z.number().int(),
        });

        expect(() =>
            Model({
                namespace: 'blog',
                name: 'Comment',
                table: '   ',
                schema,
            })
        ).toThrow('Model.table cannot be empty when provided.');
    });
});
