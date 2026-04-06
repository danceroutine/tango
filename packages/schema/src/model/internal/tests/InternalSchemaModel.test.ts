import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import type { Model, ModelMetadata } from '../../../domain/index';
import { t } from '../../index';
import { ModelRegistry } from '../../registry/ModelRegistry';
import { InternalSchemaModel } from '../InternalSchemaModel';

function createModelMetadata(): ModelMetadata {
    return {
        key: 'blog/User',
        namespace: 'blog',
        name: 'User',
        table: 'users',
        fields: [],
    };
}

describe(InternalSchemaModel, () => {
    it('creates an internal schema model with frozen internals', () => {
        const registry = new ModelRegistry();
        const model = InternalSchemaModel.create(
            {
                registry,
                namespace: 'blog',
                name: 'Post',
                schema: z.object({
                    id: z.number().int(),
                    authorId: z.number().int(),
                }),
                fields: [{ name: 'id', type: 'int', primaryKey: true }],
                relations: (r) => ({
                    author: r.belongsTo('blog/User', 'authorId'),
                }),
            },
            registry
        );
        const publicModel = model as unknown as Model;
        registry.register(publicModel);

        expect(InternalSchemaModel.getRegistryOwner(publicModel)).toBe(registry);
        expect(InternalSchemaModel.getNormalizedRelations(publicModel)).toEqual([]);
        expect(InternalSchemaModel.getExplicitFields(publicModel)).toEqual([
            { name: 'id', type: 'int', primaryKey: true },
        ]);
        expect(InternalSchemaModel.getExplicitRelations(publicModel)).toEqual({
            author: {
                type: 'belongsTo',
                target: 'blog/User',
                foreignKey: 'authorId',
            },
        });
        expect(Object.isFrozen(InternalSchemaModel.getNormalizedRelations(publicModel))).toBe(true);
        expect(Object.isFrozen(InternalSchemaModel.getExplicitFields(publicModel)!)).toBe(true);
        expect(publicModel.metadata.fields).toEqual([
            { name: 'id', type: 'int', primaryKey: true },
            { name: 'authorId', type: 'int', notNull: true, default: undefined },
        ]);
    });

    it('collects normalized field-authored relations during construction', () => {
        const registry = new ModelRegistry();
        const model = InternalSchemaModel.create(
            {
                registry,
                namespace: 'blog',
                name: 'Post',
                schema: z.object({
                    id: t.primaryKey(z.number().int()),
                    authorId: t.foreignKey('blog/User', { field: z.number().int() }),
                }),
            },
            registry
        );
        const publicModel = model as unknown as Model;

        expect(InternalSchemaModel.getNormalizedRelations(publicModel)).toEqual([
            {
                edgeId: 'blog/Post:authorId:foreignKey',
                sourceModelKey: 'blog/Post',
                sourceSchemaFieldKey: 'authorId',
                targetRef: 'blog/User',
                origin: 'foreignKey',
                localFieldName: 'authorId',
                dbColumnName: 'authorId',
                referencedTargetColumn: undefined,
                onDelete: undefined,
                onUpdate: undefined,
                unique: false,
                explicitForwardName: undefined,
                explicitReverseName: undefined,
                namingHint: 'author',
                provenance: 'field-decorator',
            },
        ]);
    });

    it('rejects models without attached registry ownership metadata', () => {
        const model = {
            metadata: createModelMetadata(),
            schema: z.object({}),
            hooks: {},
        } as unknown as Model;

        expect(() => InternalSchemaModel.getRegistryOwner(model)).toThrow(
            "Model 'blog/User' is missing internal registry ownership metadata."
        );
    });
});
