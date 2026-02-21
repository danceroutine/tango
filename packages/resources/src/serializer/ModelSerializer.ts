import type { ManagerLike } from '@danceroutine/tango-orm';
import type { ResourceModelLike } from '../resource/ResourceModelLike';
import {
    Serializer,
    type AnySerializerClass,
    type SerializerClass,
    type SerializerCreateInput,
    type SerializerOutput,
    type SerializerSchema,
    type SerializerUpdateInput,
} from './Serializer';

export type ModelSerializerClass<
    TModel extends Record<string, unknown> = Record<string, unknown>,
    TCreateSchema extends SerializerSchema = SerializerSchema,
    TUpdateSchema extends SerializerSchema = SerializerSchema,
    TOutputSchema extends SerializerSchema = SerializerSchema,
> = SerializerClass<TCreateSchema, TUpdateSchema, TOutputSchema> & {
    new (): ModelSerializer<TModel, TCreateSchema, TUpdateSchema, TOutputSchema>;
    readonly model?: ResourceModelLike<TModel>;
};

export type AnyModelSerializerClass = ModelSerializerClass<
    Record<string, unknown>,
    SerializerSchema,
    SerializerSchema,
    SerializerSchema
>;

/**
 * Zod-backed serializer with default model-manager persistence behavior.
 */
export abstract class ModelSerializer<
    TModel extends Record<string, unknown>,
    TCreateSchema extends SerializerSchema,
    TUpdateSchema extends SerializerSchema,
    TOutputSchema extends SerializerSchema,
> extends Serializer<TCreateSchema, TUpdateSchema, TOutputSchema> {
    static readonly model?: unknown;

    /**
     * Return the Tango model backing this serializer.
     */
    getModel(): ResourceModelLike<TModel> {
        const model = (
            this.constructor as Partial<ModelSerializerClass<TModel, TCreateSchema, TUpdateSchema, TOutputSchema>>
        ).model;

        if (!model) {
            throw new Error(`${this.constructor.name} must define a static model or override getModel().`);
        }

        return model;
    }

    /**
     * Return the manager used for create and update workflows.
     */
    getManager(): ManagerLike<TModel> {
        return this.getModel().objects;
    }

    /**
     * Validate, enrich, persist, and serialize a create workflow.
     */
    async create(
        input: unknown
    ): Promise<SerializerOutput<ModelSerializerClass<TModel, TCreateSchema, TUpdateSchema, TOutputSchema>>> {
        const validated = this.deserializeCreate(input);
        const prepared = await this.beforeCreate(validated);
        const created = await this.getManager().create(prepared);
        return this.toRepresentation(created);
    }

    /**
     * Validate, enrich, persist, and serialize an update workflow.
     */
    async update(
        id: TModel[keyof TModel],
        input: unknown
    ): Promise<SerializerOutput<ModelSerializerClass<TModel, TCreateSchema, TUpdateSchema, TOutputSchema>>> {
        const validated = this.deserializeUpdate(input);
        const prepared = await this.beforeUpdate(id, validated);
        const updated = await this.getManager().update(id, prepared);
        return this.toRepresentation(updated);
    }

    /**
     * Override to normalize create input for this resource workflow before the
     * manager call.
     *
     * Model-owned persistence rules belong in model hooks so they also run for
     * scripts and direct manager usage.
     */
    protected async beforeCreate(
        data: SerializerCreateInput<ModelSerializerClass<TModel, TCreateSchema, TUpdateSchema, TOutputSchema>>
    ): Promise<Partial<TModel>> {
        return data as Partial<TModel>;
    }

    /**
     * Override to normalize update input for this resource workflow before the
     * manager call.
     *
     * Model-owned persistence rules belong in model hooks so they also run for
     * scripts and direct manager usage.
     */
    protected async beforeUpdate(
        _id: TModel[keyof TModel],
        data: SerializerUpdateInput<ModelSerializerClass<TModel, TCreateSchema, TUpdateSchema, TOutputSchema>>
    ): Promise<Partial<TModel>> {
        return data as Partial<TModel>;
    }
}

export type { AnySerializerClass };
