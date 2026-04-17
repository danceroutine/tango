import type { RelationMeta, TableMeta } from '@danceroutine/tango-orm/query';

type RelationMetaInput = {
    kind: RelationMeta['kind'];
    table: string;
    sourceKey: string;
    targetKey: string;
    targetColumns: Record<string, string>;
    alias: string;
    edgeId?: string;
    sourceModelKey?: string;
    targetModelKey?: string;
    targetPrimaryKey?: string;
    targetMeta?: TableMeta;
    capabilities?: Partial<RelationMeta['capabilities']>;
};

/**
 * Build recursive relation metadata fixtures for planner/compiler/query tests.
 */
export function aRelationMeta(input: RelationMetaInput): RelationMeta {
    const cardinality = input.kind === 'belongsTo' || input.kind === 'hasOne' ? 'single' : 'many';
    const defaultHydratable = input.kind !== ('manyToMany' as RelationMeta['kind']);

    const targetMeta =
        input.targetMeta ??
        ({
            modelKey: input.targetModelKey ?? `${input.alias}:target`,
            table: input.table,
            pk: input.targetPrimaryKey ?? 'id',
            columns: input.targetColumns,
        } satisfies TableMeta);

    return {
        edgeId: input.edgeId ?? `${input.alias}:${input.sourceKey}:${input.targetKey}`,
        sourceModelKey: input.sourceModelKey ?? `${input.alias}:source`,
        targetModelKey: input.targetModelKey ?? `${input.alias}:target`,
        kind: input.kind,
        cardinality,
        capabilities: {
            queryable: true,
            hydratable: defaultHydratable,
            joinable: cardinality === 'single' && defaultHydratable,
            prefetchable: defaultHydratable,
            ...input.capabilities,
        },
        table: input.table,
        sourceKey: input.sourceKey,
        targetKey: input.targetKey,
        targetPrimaryKey: input.targetPrimaryKey ?? 'id',
        targetColumns: input.targetColumns,
        alias: input.alias,
        targetMeta,
    };
}
