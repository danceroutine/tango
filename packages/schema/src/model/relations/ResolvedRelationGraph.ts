import type {
    RelationCardinality,
    RelationProvenance,
    RelationStorageStrategy,
    RelationPublicKind,
} from './RelationSpec';

/**
 * Fully resolved relation edge published by the registry after storage
 * artifacts are finalized.
 *
 * This is the resolution-stage shape consumed by ORM-facing relation metadata.
 * Each descriptor has final naming, cardinality, key mapping, and capability
 * flags that describe whether the edge is currently migratable, queryable, and
 * hydratable.
 */
export interface ResolvedRelationDescriptor {
    edgeId: string;
    sourceModelKey: string;
    targetModelKey: string;
    name: string;
    inverseEdgeId?: string;
    kind: RelationPublicKind;
    storageStrategy: RelationStorageStrategy;
    cardinality: RelationCardinality;
    localFieldName?: string;
    targetFieldName?: string;
    capabilities: {
        migratable: boolean;
        queryable: boolean;
        hydratable: boolean;
    };
    provenance: RelationProvenance;
    alias: string;
    ambiguity?: string;
}

/**
 * Registry-scoped relation graph built from normalized relation descriptors,
 * explicit relation names, and finalized storage artifacts.
 *
 * This is the canonical resolved relation view for query planning and future
 * hydration work. It is versioned because relation resolution is scoped to a
 * specific registry snapshot.
 */
export interface ResolvedRelationGraph {
    version: number;
    byModel: ReadonlyMap<string, ReadonlyMap<string, ResolvedRelationDescriptor>>;
    byEdgeId: ReadonlyMap<string, ResolvedRelationDescriptor>;
}
