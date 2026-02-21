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

export type ResourceModelLike<TModel extends Record<string, unknown>> = {
    readonly objects: ManagerLike<TModel>;
    readonly metadata?: ResourceModelMetadata;
};
