import { z } from 'zod';
import type { IndexDef, Model } from '../../domain/index';
import { Decorators as t } from '../decorators/Decorators';
import type { ModelRef } from '../decorators/domain/ModelRef';
import { getFieldMetadata } from '../fields/FieldMetadataStore';
import type { ZodTypeAny } from '../decorators/domain/ZodTypeAny';
import {
    isZodArray,
    isZodBoolean,
    isZodDate,
    isZodDefault,
    isZodNullable,
    isZodNumber,
    isZodObject,
    isZodOptional,
    isZodString,
} from '../../domain/internal/zod/index';
import { InternalSchemaModel } from '../internal/InternalSchemaModel';
import type { ModelRegistry } from '../registry/ModelRegistry';
import type { NormalizedRelationStorageDescriptor } from './NormalizedRelationStorageDescriptor';
import { InternalNormalizedRelationOrigin } from './NormalizedRelationStorageDescriptor';
import { decapitalizeModelName } from './SchemaNaming';
import { ImplicitManyToManyIdentifier } from './ImplicitManyToManyIdentifier';
import { InternalReferentialAction } from '../../domain/internal/InternalReferentialAction';

type PrimaryKeyShape = {
    fieldKey: string;
    zod: ZodTypeAny;
    dbColumn: string;
};

export class ImplicitManyToManyThroughFactory {
    static throughFieldNames(
        sourceModel: Model,
        targetModel: Model
    ): {
        throughSourceFieldName: string;
        throughTargetFieldName: string;
    } {
        if (sourceModel.metadata.key === targetModel.metadata.key) {
            return {
                throughSourceFieldName: `from${sourceModel.metadata.name}`,
                throughTargetFieldName: `to${targetModel.metadata.name}`,
            };
        }

        return {
            throughSourceFieldName: `${decapitalizeModelName(sourceModel.metadata.name)}Id`,
            throughTargetFieldName: `${decapitalizeModelName(targetModel.metadata.name)}Id`,
        };
    }

    static buildModels(registry: ModelRegistry): Model[] {
        const descriptors = ImplicitManyToManyThroughFactory.collectImplicitDescriptors(registry);
        const models: Model[] = [];
        const occupiedTables = new Set<string>(
            [...registry.values()].map((m) => m.metadata.table.trim().toLowerCase())
        );

        for (const descriptor of descriptors) {
            const sourceModel = registry.getByKey(descriptor.sourceModelKey)!;

            const targetModel = registry.resolveRef(descriptor.targetRef);
            const identityKey = ImplicitManyToManyIdentifier.getModelKey(
                descriptor.sourceModelKey,
                descriptor.sourceSchemaFieldKey,
                targetModel.metadata.key
            );

            const pkSource = ImplicitManyToManyThroughFactory.readSinglePrimaryKey(sourceModel);
            const pkTarget = ImplicitManyToManyThroughFactory.readSinglePrimaryKey(targetModel);

            const digest = ImplicitManyToManyIdentifier.getTableBaseDigest(
                descriptor.sourceModelKey,
                descriptor.sourceSchemaFieldKey,
                targetModel.metadata.key
            );
            const tableName = ImplicitManyToManyThroughFactory.allocateTableName(occupiedTables, digest);

            const selfReferential = sourceModel.metadata.key === targetModel.metadata.key;
            let throughSchema: z.ZodObject<z.ZodRawShape>;
            let indexes: IndexDef[];

            if (selfReferential) {
                const leftKey = `from${sourceModel.metadata.name}`;
                const rightKey = `to${sourceModel.metadata.name}`;

                throughSchema = z.object({
                    id: t.primaryKey(z.number().int()),
                    [leftKey]: t.foreignKey(sourceModel as ModelRef, {
                        field: pkSource.zod,
                        onDelete: InternalReferentialAction.CASCADE,
                        onUpdate: InternalReferentialAction.CASCADE,
                    }),
                    [rightKey]: t.foreignKey(sourceModel as ModelRef, {
                        field: pkTarget.zod,
                        onDelete: InternalReferentialAction.CASCADE,
                        onUpdate: InternalReferentialAction.CASCADE,
                    }),
                });
                indexes = [
                    {
                        name: `${tableName}_uniq_pair`,
                        on: [leftKey, rightKey],
                        unique: true,
                    },
                ];
            } else {
                const sourceIdKey = `${decapitalizeModelName(sourceModel.metadata.name)}Id`;
                const targetIdKey = `${decapitalizeModelName(targetModel.metadata.name)}Id`;

                throughSchema = z.object({
                    id: t.primaryKey(z.number().int()),
                    [sourceIdKey]: t.foreignKey(sourceModel as ModelRef, {
                        field: pkSource.zod,
                        onDelete: InternalReferentialAction.CASCADE,
                        onUpdate: InternalReferentialAction.CASCADE,
                    }),
                    [targetIdKey]: t.foreignKey(targetModel as ModelRef, {
                        field: pkTarget.zod,
                        onDelete: InternalReferentialAction.CASCADE,
                        onUpdate: InternalReferentialAction.CASCADE,
                    }),
                });

                indexes = [
                    {
                        name: `${tableName}_uniq_pair`,
                        on: [sourceIdKey, targetIdKey],
                        unique: true,
                    },
                ];
            }

            const modelNamePart = ImplicitManyToManyIdentifier.getModelName(identityKey);

            const throughModel = InternalSchemaModel.create(
                {
                    namespace: ImplicitManyToManyIdentifier.getNamespace(),
                    name: modelNamePart,
                    table: tableName,
                    schema: throughSchema,
                    registry,
                    indexes,
                    managed: true,
                },
                registry
            );

            models.push(throughModel);
        }

        return models;
    }

    private static unwrapForForeignKeyField(zodType: ZodTypeAny): ZodTypeAny {
        let inner: ZodTypeAny = zodType;
        while (isZodOptional(inner)) {
            inner = inner.unwrap() as ZodTypeAny;
        }
        while (isZodNullable(inner)) {
            inner = inner.unwrap() as ZodTypeAny;
        }
        while (isZodDefault(inner)) {
            inner = inner.removeDefault() as ZodTypeAny;
        }
        return inner;
    }

    private static clonePrimaryKeySchemaForForeignKey(zodType: ZodTypeAny): ZodTypeAny {
        const unwrapped = ImplicitManyToManyThroughFactory.unwrapForForeignKeyField(zodType);

        if (isZodNumber(unwrapped)) {
            const checks = unwrapped._zod.def.checks ?? [];
            const isInt = checks.some((check) => 'format' in check._zod.def && check._zod.def.format === 'safeint');
            return isInt ? z.number().int() : z.number();
        }

        if (isZodString(unwrapped)) {
            return z.string();
        }

        if (isZodBoolean(unwrapped)) {
            return z.boolean();
        }

        if (isZodDate(unwrapped)) {
            return z.date();
        }

        if (isZodObject(unwrapped)) {
            return z.object({});
        }

        if (isZodArray(unwrapped)) {
            return z.array(z.unknown());
        }

        throw new Error('Implicit many-to-many primary keys must resolve to a clonable scalar Zod schema.');
    }

    private static readSinglePrimaryKey(model: Model): PrimaryKeyShape {
        const keys: string[] = [];
        for (const [fieldKey, zodType] of Object.entries(model.schema.shape)) {
            const meta = getFieldMetadata(zodType as ZodTypeAny);
            if (meta?.primaryKey) {
                keys.push(fieldKey);
            }
        }

        if (keys.length !== 1) {
            throw new Error(
                `Implicit many-to-many requires model '${model.metadata.key}' to declare exactly one primary key field.`
            );
        }

        const fieldKey = keys[0]!;
        const zodType = model.schema.shape[fieldKey] as ZodTypeAny;
        const meta = getFieldMetadata(zodType);
        return {
            fieldKey,
            zod: ImplicitManyToManyThroughFactory.clonePrimaryKeySchemaForForeignKey(zodType),
            dbColumn: meta?.dbColumn ?? fieldKey,
        };
    }

    private static collectImplicitDescriptors(registry: ModelRegistry): NormalizedRelationStorageDescriptor[] {
        const out: NormalizedRelationStorageDescriptor[] = [];
        for (const model of registry.values()) {
            for (const descriptor of InternalSchemaModel.getNormalizedRelations(model)) {
                if (descriptor.origin !== InternalNormalizedRelationOrigin.MANY_TO_MANY) {
                    continue;
                }
                if (
                    descriptor.throughModelRef &&
                    descriptor.throughSourceFieldName &&
                    descriptor.throughTargetFieldName
                ) {
                    continue;
                }
                out.push(descriptor);
            }
        }
        return out;
    }

    private static allocateTableName(occupied: Set<string>, digest: string): string {
        const base = `m2m_${digest}`;
        let candidate = base;
        let suffix = 0;
        while (occupied.has(candidate.toLowerCase())) {
            suffix += 1;
            candidate = `${base}_${suffix}`;
        }
        occupied.add(candidate.toLowerCase());
        return candidate;
    }
}
