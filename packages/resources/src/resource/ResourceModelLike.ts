import type { ManagerLike } from '@danceroutine/tango-orm';

export type ResourceModelFieldMetadata = {
    name: string;
    type: string;
    notNull?: boolean;
    default?: unknown;
    primaryKey?: boolean;
};

export type ResourceModelMetadata = {
    name: string;
    fields: ResourceModelFieldMetadata[];
};

export type ResourceModelLike<
    TModel extends Record<string, unknown>,
    TModelRecord extends Record<string, unknown> = TModel,
> = {
    /**
     * Resource-layer contracts own the outward representation. The underlying
     * model may materialize a richer ORM record, so the manager record type is kept
     * separate from the serializer-facing model shape.
     */
    readonly objects: ManagerLike<TModelRecord>;
    readonly metadata?: ResourceModelMetadata;
    readonly __tangoModelShape?: TModel;
};
