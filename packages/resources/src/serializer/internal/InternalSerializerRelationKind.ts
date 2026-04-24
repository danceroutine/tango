export const InternalSerializerRelationKind = {
    MANY_TO_MANY: 'manyToMany',
} as const;

export const InternalManyToManyReadStrategyKind = {
    PK_LIST: 'pkList',
    NESTED: 'nested',
} as const;

export const InternalManyToManyWriteStrategyKind = {
    PK_LIST: 'pkList',
    SLUG_LIST: 'slugList',
} as const;
