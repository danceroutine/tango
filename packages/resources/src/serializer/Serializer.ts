import { getLogger } from '@danceroutine/tango-core';
import { z } from 'zod';

export type SerializerSchema = z.ZodTypeAny;

export type SerializerClass<
    TCreateSchema extends SerializerSchema = SerializerSchema,
    TUpdateSchema extends SerializerSchema = SerializerSchema,
    TOutputSchema extends SerializerSchema = SerializerSchema,
    TRecord = unknown,
> = {
    new (): Serializer<TCreateSchema, TUpdateSchema, TOutputSchema, TRecord>;
    readonly createSchema: TCreateSchema;
    readonly updateSchema: TUpdateSchema;
    readonly outputSchema: TOutputSchema;
    readonly outputResolvers?: SerializerOutputResolvers<TRecord>;
};

export type AnySerializerClass = SerializerClass<
    SerializerSchema,
    SerializerSchema,
    SerializerSchema,
    // oxlint-disable-next-line typescript/no-explicit-any
    any
>;

export type SerializerCreateInput<TSerializer extends AnySerializerClass> = z.output<TSerializer['createSchema']>;
export type SerializerUpdateInput<TSerializer extends AnySerializerClass> = z.output<TSerializer['updateSchema']>;
export type SerializerOutput<TSerializer extends AnySerializerClass> = z.output<TSerializer['outputSchema']>;
export type SerializerOutputResolver<TRecord = unknown> = (record: TRecord) => unknown | Promise<unknown>;
export type SerializerOutputResolvers<TRecord = unknown> = Record<string, SerializerOutputResolver<TRecord>>;

const logger = getLogger('tango.resources.serializer');
let hasWarnedAboutToRepresentationDeprecation = false;

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
    TRecord = unknown,
> {
    static readonly createSchema: SerializerSchema = z.unknown();
    static readonly updateSchema: SerializerSchema = z.unknown();
    static readonly outputSchema: SerializerSchema = z.unknown();
    static readonly outputResolvers:
        | SerializerOutputResolvers<// oxlint-disable-next-line typescript/no-explicit-any
          any>
        | undefined = undefined;

    /**
     * Return the serializer class for the current instance.
     */
    getSerializerClass(): SerializerClass<TCreateSchema, TUpdateSchema, TOutputSchema, TRecord> {
        return this.constructor as SerializerClass<TCreateSchema, TUpdateSchema, TOutputSchema, TRecord>;
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
     * Return the resolver map used to enrich serializer output fields before
     * the outward Zod schema parses the final response shape.
     */
    getOutputResolvers(): SerializerOutputResolvers<TRecord> {
        return this.getSerializerClass().outputResolvers ?? {};
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
     *
     * @deprecated Use `serialize(...)` instead so serializer-owned output
     * resolvers run before the outward Zod schema parses the response shape.
     */
    toRepresentation(record: TRecord): z.output<TOutputSchema> {
        if (!hasWarnedAboutToRepresentationDeprecation) {
            hasWarnedAboutToRepresentationDeprecation = true;
            logger.warn(
                '`Serializer.toRepresentation(...)` is deprecated. Use `serialize(...)` instead so output resolvers run before outward parsing.'
            );
        }
        return this.getOutputSchema().parse(record);
    }

    /**
     * Resolve serializer-owned output fields and parse the outward response
     * contract.
     */
    async serialize(record: TRecord): Promise<z.output<TOutputSchema>> {
        return this.getOutputSchema().parse(await this.applyOutputResolvers(record));
    }

    /**
     * Serialize many records through the same outward response contract.
     */
    async serializeMany(records: readonly TRecord[]): Promise<z.output<TOutputSchema>[]> {
        return Promise.all(records.map((record) => this.serialize(record)));
    }

    private async applyOutputResolvers(record: TRecord): Promise<unknown> {
        const resolvers = this.getOutputResolvers();
        const resolverEntries = Object.entries(resolvers);

        if (resolverEntries.length === 0 || typeof record !== 'object' || record === null) {
            return record;
        }

        const resolved = await Promise.all(
            resolverEntries.map(async ([key, resolver]) => [key, await resolver(record)] as const)
        );

        return {
            ...(record as Record<string, unknown>),
            ...Object.fromEntries(resolved),
        };
    }
}
