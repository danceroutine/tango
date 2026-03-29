import { z } from 'zod';

export type SerializerSchema = z.ZodTypeAny;

export type SerializerClass<
    TCreateSchema extends SerializerSchema = SerializerSchema,
    TUpdateSchema extends SerializerSchema = SerializerSchema,
    TOutputSchema extends SerializerSchema = SerializerSchema,
> = {
    new (): Serializer<TCreateSchema, TUpdateSchema, TOutputSchema>;
    readonly createSchema: TCreateSchema;
    readonly updateSchema: TUpdateSchema;
    readonly outputSchema: TOutputSchema;
};

export type AnySerializerClass = SerializerClass<SerializerSchema, SerializerSchema, SerializerSchema>;

export type SerializerCreateInput<TSerializer extends AnySerializerClass> = z.output<TSerializer['createSchema']>;
export type SerializerUpdateInput<TSerializer extends AnySerializerClass> = z.output<TSerializer['updateSchema']>;
export type SerializerOutput<TSerializer extends AnySerializerClass> = z.output<TSerializer['outputSchema']>;

/**
 * DRF-inspired base serializer backed by Zod schemas.
 *
 * Tango serializers keep Zod as the source of truth for validation and type
 * inference while centralizing create, update, and representation workflows in
 * one class-owned contract.
 */
export abstract class Serializer<
    TCreateSchema extends SerializerSchema,
    TUpdateSchema extends SerializerSchema,
    TOutputSchema extends SerializerSchema,
> {
    static readonly createSchema: SerializerSchema = z.unknown();
    static readonly updateSchema: SerializerSchema = z.unknown();
    static readonly outputSchema: SerializerSchema = z.unknown();

    /**
     * Return the serializer class for the current instance.
     */
    getSerializerClass(): SerializerClass<TCreateSchema, TUpdateSchema, TOutputSchema> {
        return this.constructor as SerializerClass<TCreateSchema, TUpdateSchema, TOutputSchema>;
    }

    /**
     * Return the Zod schema used for create payloads.
     */
    getCreateSchema(): TCreateSchema {
        return this.getSerializerClass().createSchema;
    }

    /**
     * Return the Zod schema used for update payloads.
     */
    getUpdateSchema(): TUpdateSchema {
        return this.getSerializerClass().updateSchema;
    }

    /**
     * Return the Zod schema used for serialized output.
     */
    getOutputSchema(): TOutputSchema {
        return this.getSerializerClass().outputSchema;
    }

    /**
     * Validate unknown input for create workflows.
     */
    deserializeCreate(input: unknown): z.output<TCreateSchema> {
        return this.getCreateSchema().parse(input);
    }

    /**
     * Validate unknown input for update workflows.
     */
    deserializeUpdate(input: unknown): z.output<TUpdateSchema> {
        return this.getUpdateSchema().parse(input);
    }

    /**
     * Convert a persisted record into its outward-facing representation.
     */
    toRepresentation(record: unknown): z.output<TOutputSchema> {
        return this.getOutputSchema().parse(record);
    }
}
