import { z } from 'zod';
import type { ManyToManyRelatedManager } from '@danceroutine/tango-orm';
import type { ResourceModelLike } from '../resource/ResourceModelLike';
import {
    InternalManyToManyReadStrategyKind,
    InternalManyToManyWriteStrategyKind,
    InternalSerializerRelationKind,
} from './internal/InternalSerializerRelationKind';

type AnyRecord = Record<string, unknown>;

export type ManyToManyManagerKeys<TRecord extends AnyRecord> = Extract<
    {
        [K in keyof TRecord]: TRecord[K] extends ManyToManyRelatedManager<AnyRecord> ? K : never;
    }[keyof TRecord],
    string
>;

export type ManyToManyTargetRow<TRecord extends AnyRecord, TFieldName extends ManyToManyManagerKeys<TRecord>> =
    TRecord[TFieldName] extends ManyToManyRelatedManager<infer TTarget extends AnyRecord> ? TTarget : never;

export type ManyToManyPkListStrategy = {
    kind: typeof InternalManyToManyReadStrategyKind.PK_LIST | typeof InternalManyToManyWriteStrategyKind.PK_LIST;
};

export type ManyToManyNestedStrategy = {
    kind: typeof InternalManyToManyReadStrategyKind.NESTED;
    schema: z.ZodTypeAny;
};

export type ManyToManySlugListStrategy<TTarget extends AnyRecord> = {
    kind: typeof InternalManyToManyWriteStrategyKind.SLUG_LIST;
    // oxlint-disable-next-line typescript/no-explicit-any
    model: ResourceModelLike<any, any>;
    lookupField: Extract<keyof TTarget, string>;
    createIfMissing?: boolean;
    buildCreateInput?: (value: string) => Partial<TTarget>;
};

export type ManyToManyReadStrategy = ManyToManyPkListStrategy | ManyToManyNestedStrategy;
export type ManyToManyWriteStrategy<TTarget extends AnyRecord> =
    | ManyToManyPkListStrategy
    | ManyToManySlugListStrategy<TTarget>;

export type ManyToManyRelationField<TRecord extends AnyRecord, TFieldName extends ManyToManyManagerKeys<TRecord>> = {
    kind: typeof InternalSerializerRelationKind.MANY_TO_MANY;
    read: ManyToManyReadStrategy;
    write: ManyToManyWriteStrategy<ManyToManyTargetRow<TRecord, TFieldName>>;
};

export type ModelSerializerRelationFields<TRecord extends AnyRecord> = Partial<{
    [K in ManyToManyManagerKeys<TRecord>]: ManyToManyRelationField<TRecord, K>;
}>;

function pkList(): ManyToManyPkListStrategy {
    return { kind: InternalManyToManyReadStrategyKind.PK_LIST };
}

function nested(schema: z.ZodTypeAny): ManyToManyNestedStrategy {
    return { kind: InternalManyToManyReadStrategyKind.NESTED, schema };
}

function slugList<TTarget extends AnyRecord>(
    options: Omit<ManyToManySlugListStrategy<TTarget>, 'kind'>
): ManyToManySlugListStrategy<TTarget> {
    return {
        kind: InternalManyToManyWriteStrategyKind.SLUG_LIST,
        ...options,
    };
}

function manyToMany(
    // oxlint-disable-next-line typescript/no-explicit-any
    config: Partial<Pick<ManyToManyRelationField<any, any>, 'read' | 'write'>> = {}
    // oxlint-disable-next-line typescript/no-explicit-any
): ManyToManyRelationField<any, any> {
    return {
        kind: InternalSerializerRelationKind.MANY_TO_MANY,
        read: config.read ?? pkList(),
        write: config.write ?? pkList(),
    };
}

export type RelationHelpers = {
    manyToMany: typeof manyToMany;
    pkList: typeof pkList;
    nested: typeof nested;
    slugList: typeof slugList;
};

export const relation: RelationHelpers = {
    manyToMany: manyToMany,
    pkList: pkList,
    nested: nested,
    slugList: slugList,
};
