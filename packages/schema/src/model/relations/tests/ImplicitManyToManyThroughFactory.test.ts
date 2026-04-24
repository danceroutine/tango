import { beforeEach, describe, expect, it } from 'vitest';
import { z } from 'zod';
import { Model, ModelRegistry, t } from '../../index';
import { ImplicitManyToManyIdentifier } from '../ImplicitManyToManyIdentifier';
import { ImplicitManyToManyThroughFactory } from '../ImplicitManyToManyThroughFactory';

describe(ImplicitManyToManyThroughFactory, () => {
    beforeEach(() => {
        ModelRegistry.clear();
    });

    it('separates from and to field names for a self-referential many-to-many', () => {
        const PostModel = Model({
            namespace: 'blog',
            name: 'Post',
            schema: z.object({
                id: t.primaryKey(z.number().int()),
                related: t.manyToMany('blog/Post', { name: 'related' }),
            }),
        });
        const names = ImplicitManyToManyThroughFactory.throughFieldNames(PostModel, PostModel);
        expect(names).toEqual({ throughSourceFieldName: 'fromPost', throughTargetFieldName: 'toPost' });
        const implicit = ImplicitManyToManyThroughFactory.buildModels(ModelRegistry.global())[0];
        expect(implicit?.schema.shape.fromPost).toBeDefined();
        expect(implicit?.schema.shape.toPost).toBeDefined();
    });

    it('uses foreign key suffix field names when endpoints differ', () => {
        const TagModel = Model({
            namespace: 'blog',
            name: 'Tag',
            schema: z.object({
                id: t.primaryKey(z.number().int()),
            }),
        });
        const PostModel = Model({
            namespace: 'blog',
            name: 'Post',
            schema: z.object({
                id: t.primaryKey(z.number().int()),
                tags: t.manyToMany('blog/Tag'),
            }),
        });
        expect(ImplicitManyToManyThroughFactory.throughFieldNames(PostModel, TagModel)).toEqual({
            throughSourceFieldName: 'postId',
            throughTargetFieldName: 'tagId',
        });
    });

    it('requires both endpoints to declare exactly one primary key field', () => {
        Model({
            namespace: 'blog',
            name: 'Tag',
            schema: z.object({
                slug: z.string(),
            }),
        });
        Model({
            namespace: 'blog',
            name: 'Post',
            schema: z.object({
                id: t.primaryKey(z.number().int()),
                tags: t.manyToMany('blog/Tag'),
            }),
        });
        expect(() => ImplicitManyToManyThroughFactory.buildModels(ModelRegistry.global())).toThrow(
            /exactly one primary key field/
        );
    });

    it('unwraps nullable primary key wrappers when synthesizing implicit join foreign keys', () => {
        Model({
            namespace: 'blog',
            name: 'Tag',
            schema: z.object({
                id: t.primaryKey(z.number().int().nullable()),
            }),
        });
        Model({
            namespace: 'blog',
            name: 'Post',
            schema: z.object({
                id: t.primaryKey(z.number().int()),
                tags: t.manyToMany('blog/Tag'),
            }),
        });
        expect(ImplicitManyToManyThroughFactory.buildModels(ModelRegistry.global())[0]).toBeDefined();
    });

    it('unwraps optional primary key wrappers when synthesizing implicit join foreign keys', () => {
        Model({
            namespace: 'shop',
            name: 'Tag',
            schema: z.object({
                id: t.primaryKey(z.number().int().optional()),
            }),
        });
        Model({
            namespace: 'shop',
            name: 'Post',
            schema: z.object({
                id: t.primaryKey(z.number().int()),
                tags: t.manyToMany('shop/Tag'),
            }),
        });
        expect(ImplicitManyToManyThroughFactory.buildModels(ModelRegistry.global())[0]).toBeDefined();
    });

    it('unwraps default primary key wrappers when synthesizing implicit join foreign keys', () => {
        Model({
            namespace: 'shop',
            name: 'Brand',
            schema: z.object({
                id: t.primaryKey(z.number().int().default(0)),
            }),
        });
        Model({
            namespace: 'shop',
            name: 'Article',
            schema: z.object({
                id: t.primaryKey(z.number().int()),
                brands: t.manyToMany('shop/Brand'),
            }),
        });
        expect(ImplicitManyToManyThroughFactory.buildModels(ModelRegistry.global())[0]).toBeDefined();
    });

    it('preserves non-integer numeric primary keys when cloning implicit join foreign keys', () => {
        Model({
            namespace: 'math',
            name: 'Tag',
            schema: z.object({
                id: t.primaryKey(z.number()),
            }),
        });
        Model({
            namespace: 'math',
            name: 'Post',
            schema: z.object({
                id: t.primaryKey(z.number().int()),
                tags: t.manyToMany('math/Tag'),
            }),
        });

        const implicit = ImplicitManyToManyThroughFactory.buildModels(ModelRegistry.global())[0];
        const throughTargetField = implicit?.schema.shape.tagId as z.ZodNumber | undefined;
        expect(throughTargetField?.parse(3.14)).toBe(3.14);
    });

    it('preserves numeric primary keys with non-integer checks when cloning implicit join foreign keys', () => {
        Model({
            namespace: 'mathChecked',
            name: 'Tag',
            schema: z.object({
                id: t.primaryKey(z.number().positive()),
            }),
        });
        Model({
            namespace: 'mathChecked',
            name: 'Post',
            schema: z.object({
                id: t.primaryKey(z.number().int()),
                tags: t.manyToMany('mathChecked/Tag'),
            }),
        });

        const implicit = ImplicitManyToManyThroughFactory.buildModels(ModelRegistry.global())[0];
        const throughTargetField = implicit?.schema.shape.tagId as z.ZodNumber | undefined;
        expect(throughTargetField?.parse(2.5)).toBe(2.5);
    });

    it('treats non-safeint numeric format checks as plain numbers when cloning join foreign keys', () => {
        const numericPrimaryKey = z.number().int();
        const checks = numericPrimaryKey._zod.def.checks ?? [];
        const firstCheck = checks[0];
        expect(firstCheck).toBeDefined();
        if (firstCheck) {
            (firstCheck._zod.def as { format?: string }).format = 'int32';
        }

        const clonePrimaryKeySchemaForForeignKey = (
            ImplicitManyToManyThroughFactory as unknown as {
                clonePrimaryKeySchemaForForeignKey: (zodType: z.ZodTypeAny) => z.ZodTypeAny;
            }
        ).clonePrimaryKeySchemaForForeignKey;

        const cloned = clonePrimaryKeySchemaForForeignKey(numericPrimaryKey);
        expect(cloned.parse(2.5)).toBe(2.5);
    });

    it('falls back to an empty numeric check list when cloning join foreign keys', () => {
        const numericPrimaryKey = z.number() as z.ZodTypeAny & {
            _zod: { def: { checks?: unknown[] } };
        };
        delete numericPrimaryKey._zod.def.checks;

        const clonePrimaryKeySchemaForForeignKey = (
            ImplicitManyToManyThroughFactory as unknown as {
                clonePrimaryKeySchemaForForeignKey: (zodType: z.ZodTypeAny) => z.ZodTypeAny;
            }
        ).clonePrimaryKeySchemaForForeignKey;

        const cloned = clonePrimaryKeySchemaForForeignKey(numericPrimaryKey);
        expect(cloned.parse(1.25)).toBe(1.25);
    });

    it('clones supported non-numeric primary key schemas for implicit join foreign keys', () => {
        const cases = [
            {
                name: 'string',
                primaryKeySchema: z.string().min(1),
                expectSchema: (schema: z.ZodTypeAny) => expect(schema.parse('tag-1')).toBe('tag-1'),
            },
            {
                name: 'boolean',
                primaryKeySchema: z.boolean(),
                expectSchema: (schema: z.ZodTypeAny) => expect(schema.parse(true)).toBe(true),
            },
            {
                name: 'date',
                primaryKeySchema: z.date(),
                expectSchema: (schema: z.ZodTypeAny) =>
                    expect(schema.parse(new Date('2026-04-23'))).toBeInstanceOf(Date),
            },
            {
                name: 'object',
                primaryKeySchema: z.object({ slug: z.string() }),
                expectSchema: (schema: z.ZodTypeAny) => expect(schema.parse({})).toEqual({}),
            },
            {
                name: 'array',
                primaryKeySchema: z.array(z.string()),
                expectSchema: (schema: z.ZodTypeAny) => expect(schema.parse(['tag-1'])).toEqual(['tag-1']),
            },
        ] as const;

        for (const [index, testCase] of cases.entries()) {
            Model({
                namespace: `case${index}`,
                name: 'Tag',
                schema: z.object({
                    id: t.primaryKey(testCase.primaryKeySchema),
                }),
            });
            Model({
                namespace: `case${index}`,
                name: 'Post',
                schema: z.object({
                    id: t.primaryKey(z.number().int()),
                    tags: t.manyToMany(`case${index}/Tag`),
                }),
            });
        }

        const implicitModels = ImplicitManyToManyThroughFactory.buildModels(ModelRegistry.global());
        expect(implicitModels).toHaveLength(cases.length);

        for (const [index, testCase] of cases.entries()) {
            const implicitModel = implicitModels[index];
            expect(implicitModel).toBeDefined();
            const throughTargetField = implicitModel?.schema.shape.tagId;
            expect(throughTargetField).toBeDefined();
            testCase.expectSchema(throughTargetField as z.ZodTypeAny);
        }
    });

    it('rejects unsupported primary key schemas when cloning implicit join foreign keys', () => {
        Model({
            namespace: 'blog',
            name: 'Tag',
            schema: z.object({
                id: t.primaryKey(z.union([z.string(), z.number()])),
            }),
        });
        Model({
            namespace: 'blog',
            name: 'Post',
            schema: z.object({
                id: t.primaryKey(z.number().int()),
                tags: t.manyToMany('blog/Tag'),
            }),
        });

        expect(() => ImplicitManyToManyThroughFactory.buildModels(ModelRegistry.global())).toThrow(
            /must resolve to a clonable scalar Zod schema/
        );
    });

    it('suffixes join table names when the digest collides with an existing physical table', () => {
        const digest = ImplicitManyToManyIdentifier.getTableBaseDigest('blog/Post', 'tags', 'blog/Tag');
        Model({
            namespace: 'blog',
            name: 'Holder',
            table: `m2m_${digest}`,
            schema: z.object({
                id: t.primaryKey(z.number().int()),
            }),
        });
        Model({
            namespace: 'blog',
            name: 'Tag',
            schema: z.object({
                id: t.primaryKey(z.number().int()),
            }),
        });
        Model({
            namespace: 'blog',
            name: 'Post',
            schema: z.object({
                id: t.primaryKey(z.number().int()),
                tags: t.manyToMany('blog/Tag'),
            }),
        });
        const implicit = ImplicitManyToManyThroughFactory.buildModels(ModelRegistry.global())[0];
        expect(implicit?.metadata.table).toBe(`m2m_${digest}_1`);
    });

    it('applies cascading foreign-key actions to implicit join tables', () => {
        Model({
            namespace: 'blog',
            name: 'Tag',
            schema: z.object({
                id: t.primaryKey(z.number().int()),
            }),
        });
        Model({
            namespace: 'blog',
            name: 'Post',
            schema: z.object({
                id: t.primaryKey(z.number().int()),
                tags: t.manyToMany('blog/Tag'),
            }),
        });

        const implicit = ImplicitManyToManyThroughFactory.buildModels(ModelRegistry.global())[0];
        const postId = implicit?.metadata.fields.find((field) => field.name === 'postId');
        const tagId = implicit?.metadata.fields.find((field) => field.name === 'tagId');

        expect(postId?.references?.onDelete).toBe('CASCADE');
        expect(postId?.references?.onUpdate).toBe('CASCADE');
        expect(tagId?.references?.onDelete).toBe('CASCADE');
        expect(tagId?.references?.onUpdate).toBe('CASCADE');
    });
});
