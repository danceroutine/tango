/**
 * Discriminator strings for compiled prefetch hydration: how `QueryCompiler.compilePrefetch`
 * batches related rows for hydration (`CompiledPrefetchQuery`).
 */
export const InternalPrefetchQueryKind = {
    /**
     * Single-query prefetch against the related table (`SELECT … FROM target WHERE fk IN (...)`).
     * Used when each related row is reachable from one physical table via a foreign key or
     * symmetric join path (belongsTo, hasMany, hasOne, reverse one-to-one).
     */
    DIRECT: 'direct',

    /**
     * Two-phase many-to-many prefetch: first query reads join (through) rows pairing owner ids to
     * target ids (`throughSql`), then target rows load by primary key (`compileManyToManyTargets`).
     * Distinct from relation metadata’s `manyToMany` relation *kind* on an endpoint—this marks the
     * compiled prefetch *strategy*, not the schema edge type.
     */
    MANY_TO_MANY: 'manyToMany',
} as const;

export type PrefetchQueryKind = (typeof InternalPrefetchQueryKind)[keyof typeof InternalPrefetchQueryKind];
