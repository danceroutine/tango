import type { FilterInput, ManagerLike, ManyToManyTargetRef } from '@danceroutine/tango-orm';
import { ManyToManyRelatedManager } from '@danceroutine/tango-orm';
import type { ResourceModelLike } from '../resource/ResourceModelLike';
import {
    Serializer,
    type AnySerializerClass,
    type SerializerClass,
    type SerializerCreateInput,
    type SerializerOutput,
    type SerializerOutputResolvers,
    type SerializerSchema,
    type SerializerUpdateInput,
} from './Serializer';
import type { ManyToManyManagerKeys, ManyToManyRelationField, ModelSerializerRelationFields } from './relation';
import {
    InternalManyToManyReadStrategyKind,
    InternalManyToManyWriteStrategyKind,
    InternalSerializerRelationKind,
} from './internal/InternalSerializerRelationKind';

// oxlint-disable-next-line typescript/no-explicit-any
type AnyRelationField = ManyToManyRelationField<any, any>;

export type ModelSerializerClass<
    TModel extends Record<string, unknown> = Record<string, unknown>,
    TCreateSchema extends SerializerSchema = SerializerSchema,
    TUpdateSchema extends SerializerSchema = SerializerSchema,
    TOutputSchema extends SerializerSchema = SerializerSchema,
    TModelRecord extends Record<string, unknown> = TModel,
> = SerializerClass<TCreateSchema, TUpdateSchema, TOutputSchema, TModelRecord> & {
    new (): ModelSerializer<TModel, TCreateSchema, TUpdateSchema, TOutputSchema, TModelRecord>;
    readonly model?: ResourceModelLike<TModel, TModelRecord>;
    readonly relationFields?: ModelSerializerRelationFields<TModelRecord>;
};

//
export type AnyModelSerializer<TModel extends Record<string, unknown> = Record<string, unknown>> = ModelSerializerClass<
    TModel,
    SerializerSchema,
    SerializerSchema,
    SerializerSchema,
    // oxlint-disable-next-line typescript/no-explicit-any
    any
>;

export type AnyModelSerializerClass = AnyModelSerializer;

/**
 * Zod-backed serializer with default model-manager persistence behavior.
 */
export abstract class ModelSerializer<
    TModel extends Record<string, unknown>,
    TCreateSchema extends SerializerSchema,
    TUpdateSchema extends SerializerSchema,
    TOutputSchema extends SerializerSchema,
    TModelRecord extends Record<string, unknown> = TModel,
> extends Serializer<TCreateSchema, TUpdateSchema, TOutputSchema, TModelRecord> {
    static readonly model?: unknown;
    static readonly relationFields: ModelSerializerRelationFields<Record<string, unknown>> | undefined = undefined;

    /**
     * Return the Tango model backing this serializer.
     */
    getModel(): ResourceModelLike<TModel, TModelRecord> {
        const model = (
            this.constructor as Partial<
                ModelSerializerClass<TModel, TCreateSchema, TUpdateSchema, TOutputSchema, TModelRecord>
            >
        ).model;

        if (!model) {
            throw new Error(`${this.constructor.name} must define a static model or override getModel().`);
        }

        return model;
    }

    /**
     * Return the manager used for create and update workflows.
     */
    getManager(): ManagerLike<TModelRecord> {
        return this.getModel().objects as ManagerLike<TModelRecord>;
    }

    /**
     * Return the declarative relation-field map for this serializer.
     */
    getRelationFields(): ModelSerializerRelationFields<TModelRecord> {
        return (
            (
                this.constructor as Partial<
                    ModelSerializerClass<TModel, TCreateSchema, TUpdateSchema, TOutputSchema, TModelRecord>
                >
            ).relationFields ?? {}
        );
    }

    /**
     * Merge relation-field read resolvers into the serializer output path.
     */
    override getOutputResolvers(): SerializerOutputResolvers<TModelRecord> {
        const baseResolvers = super.getOutputResolvers();
        const relationFields = this.getRelationFields() as Record<string, AnyRelationField>;
        const relationResolvers = Object.fromEntries(
            Object.entries(relationFields).map(([fieldName, field]) => [
                fieldName,
                async (record: TModelRecord) => this.serializeRelationField(record, fieldName, field),
            ])
        ) as SerializerOutputResolvers<TModelRecord>;

        return {
            ...relationResolvers,
            ...baseResolvers,
        };
    }

    /**
     * Validate, enrich, persist, and serialize a create workflow.
     */
    async create(
        input: unknown
    ): Promise<
        SerializerOutput<ModelSerializerClass<TModel, TCreateSchema, TUpdateSchema, TOutputSchema, TModelRecord>>
    > {
        const validated = this.deserializeCreate(input);
        const relationWrites = this.extractRelationWrites(validated, input);
        const prepared = await this.beforeCreate(validated);
        const created = await this.getManager().create(this.stripRelationFields(prepared));
        await this.applyRelationWrites(created, relationWrites);
        return this.serialize(created);
    }

    /**
     * Validate, enrich, persist, and serialize an update workflow.
     */
    async update(
        id: TModelRecord[keyof TModelRecord],
        input: unknown
    ): Promise<
        SerializerOutput<ModelSerializerClass<TModel, TCreateSchema, TUpdateSchema, TOutputSchema, TModelRecord>>
    > {
        const validated = this.deserializeUpdate(input);
        const relationWrites = this.extractRelationWrites(validated, input);
        const prepared = await this.beforeUpdate(id, validated);
        const updated = await this.getManager().update(id, this.stripRelationFields(prepared));
        await this.applyRelationWrites(updated, relationWrites);
        return this.serialize(updated);
    }

    /**
     * Override to normalize create input for this resource workflow before the
     * manager call.
     *
     * Model-owned persistence rules belong in model hooks so they also run for
     * scripts and direct manager usage.
     */
    protected async beforeCreate(
        data: SerializerCreateInput<
            ModelSerializerClass<TModel, TCreateSchema, TUpdateSchema, TOutputSchema, TModelRecord>
        >
    ): Promise<Partial<TModelRecord>> {
        return data as Partial<TModelRecord>;
    }

    /**
     * Override to normalize update input for this resource workflow before the
     * manager call.
     *
     * Model-owned persistence rules belong in model hooks so they also run for
     * scripts and direct manager usage.
     */
    protected async beforeUpdate(
        _id: TModelRecord[keyof TModelRecord],
        data: SerializerUpdateInput<
            ModelSerializerClass<TModel, TCreateSchema, TUpdateSchema, TOutputSchema, TModelRecord>
        >
    ): Promise<Partial<TModelRecord>> {
        return data as Partial<TModelRecord>;
    }

    private extractRelationWrites(
        data: unknown,
        rawInput: unknown
    ): Partial<Record<ManyToManyManagerKeys<TModelRecord>, unknown>> {
        if (typeof data !== 'object' || data === null || typeof rawInput !== 'object' || rawInput === null) {
            return {};
        }

        const relationFields = this.getRelationFields() as Record<string, AnyRelationField>;
        const writes: Partial<Record<ManyToManyManagerKeys<TModelRecord>, unknown>> = {};

        for (const fieldName of Object.keys(relationFields) as ManyToManyManagerKeys<TModelRecord>[]) {
            if (fieldName in rawInput) {
                writes[fieldName] = (data as Record<string, unknown>)[fieldName];
            }
        }

        return writes;
    }

    private stripRelationFields(data: Partial<TModelRecord>): Partial<TModelRecord> {
        const relationFieldNames = new Set(Object.keys(this.getRelationFields()));
        if (relationFieldNames.size === 0) {
            return data;
        }

        return Object.fromEntries(
            Object.entries(data as Record<string, unknown>).filter(([fieldName]) => !relationFieldNames.has(fieldName))
        ) as Partial<TModelRecord>;
    }

    private async applyRelationWrites(
        record: TModelRecord,
        writes: Partial<Record<ManyToManyManagerKeys<TModelRecord>, unknown>>
    ): Promise<void> {
        const relationFields = this.getRelationFields() as Record<string, AnyRelationField>;

        for (const [fieldName, value] of Object.entries(writes) as Array<
            [ManyToManyManagerKeys<TModelRecord>, unknown]
        >) {
            const field = relationFields[fieldName];
            if (!field) {
                continue;
            }
            await this.syncManyToManyRelation(record, fieldName, value);
        }
    }

    private async serializeRelationField(
        record: TModelRecord,
        fieldName: string,
        field: AnyRelationField
    ): Promise<unknown> {
        const manager = this.getManyToManyManager(record, fieldName);
        const rows = (await manager.all().fetch()).results;
        const relationMeta = this.getManyToManyRelationMeta(fieldName);

        switch (field.read.kind) {
            case InternalManyToManyReadStrategyKind.PK_LIST:
                return rows.map((row) => row[relationMeta.targetPrimaryKey]);
            case InternalManyToManyReadStrategyKind.NESTED:
                return rows.map((row) =>
                    (field.read as { schema: { parse: (input: unknown) => unknown } }).schema.parse(row)
                );
        }
    }

    private async syncManyToManyRelation(
        record: TModelRecord,
        fieldName: ManyToManyManagerKeys<TModelRecord>,
        value: unknown
    ): Promise<void> {
        if (value === undefined) {
            return;
        }

        const manager = this.getManyToManyManager(record, fieldName);
        const field = (this.getRelationFields() as Record<string, AnyRelationField>)[fieldName];
        if (!field) {
            return;
        }

        const nextTargets = await this.resolveWriteTargets(fieldName, field.write, value);
        const currentTargets = (await manager.all().fetch()).results;
        if (currentTargets.length > 0) {
            await manager.remove(...currentTargets);
        }
        if (nextTargets.length > 0) {
            await manager.add(...nextTargets);
        }
    }

    private async resolveWriteTargets(
        fieldName: ManyToManyManagerKeys<TModelRecord>,
        strategy: AnyRelationField['write'],
        value: unknown
    ): Promise<readonly ManyToManyTargetRef<Record<string, unknown>>[]> {
        switch (strategy.kind) {
            case InternalManyToManyWriteStrategyKind.PK_LIST:
                if (!Array.isArray(value)) {
                    throw new TypeError(
                        `Relation field '${String(fieldName)}' expects an array of primary-key values.`
                    );
                }
                return value as readonly ManyToManyTargetRef<Record<string, unknown>>[];
            case InternalManyToManyWriteStrategyKind.SLUG_LIST: {
                if (!Array.isArray(value)) {
                    throw new TypeError(`Relation field '${String(fieldName)}' expects an array of lookup values.`);
                }

                const lookupValues = [...new Set(value.map((entry) => String(entry).trim()).filter(Boolean))];
                if (lookupValues.length === 0) {
                    return [];
                }

                const filter = {
                    [`${strategy.lookupField}__in`]: lookupValues,
                } as FilterInput<Record<string, unknown>>;
                const existing = await strategy.model.objects.query().filter(filter).fetch();
                const byLookup = new Map(
                    existing.results.map((row) => [String((row as Record<string, unknown>)[strategy.lookupField]), row])
                );
                const resolved: Record<string, unknown>[] = [];

                for (const lookupValue of lookupValues) {
                    const found = byLookup.get(lookupValue);
                    if (found) {
                        resolved.push(found);
                        continue;
                    }

                    if (!strategy.createIfMissing) {
                        throw new Error(
                            `Relation field '${String(fieldName)}' could not resolve '${lookupValue}' via '${strategy.lookupField}'.`
                        );
                    }

                    const created = await strategy.model.objects.create(
                        strategy.buildCreateInput?.(lookupValue) ??
                            ({ [strategy.lookupField]: lookupValue } as Record<string, unknown>)
                    );
                    resolved.push(created as Record<string, unknown>);
                }

                return resolved;
            }
        }
    }

    private getManyToManyManager(
        record: TModelRecord,
        fieldName: string
    ): ManyToManyRelatedManager<Record<string, unknown>> {
        const manager = (record as Record<string, unknown>)[fieldName];
        if (!ManyToManyRelatedManager.isManyToManyRelatedManager(manager)) {
            throw new Error(`Relation field '${fieldName}' is not backed by a many-to-many related manager.`);
        }
        return manager as ManyToManyRelatedManager<Record<string, unknown>>;
    }

    private getManyToManyRelationMeta(
        fieldName: string
    ): NonNullable<NonNullable<ManagerLike<TModelRecord>['meta']['relations']>[string]> {
        const relation = this.getManager().meta.relations?.[fieldName];
        if (!relation || relation.kind !== InternalSerializerRelationKind.MANY_TO_MANY) {
            throw new Error(`Relation field '${fieldName}' is not a persisted many-to-many edge.`);
        }
        return relation;
    }
}

export type { AnySerializerClass };
