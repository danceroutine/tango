export interface CompiledQuery {
    sql: string;
    params: readonly unknown[];
    hydrations?: readonly CompiledRelationHydration[];
    prefetches?: readonly CompiledPrefetchHydration[];
}

export interface CompiledRelationHydration {
    relationName: string;
    alias: string;
    columns: Record<string, string>;
}

export interface CompiledPrefetchHydration {
    relationName: string;
    sourceKey: string;
    sourceKeyAlias?: string;
    table: string;
    targetKey: string;
    targetColumns: Record<string, string>;
}

export interface CompiledPrefetchQuery {
    sql: string;
    params: readonly unknown[];
    targetKey: string;
    targetColumns: Record<string, string>;
}
