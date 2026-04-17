import type { RelationCardinality, RelationPublicKind, RelationStorageStrategy } from '../relations/RelationSpec';

export type ResolvedRelationGraphSnapshotRelation = {
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
    alias: string;
    capabilities: {
        migratable: boolean;
        queryable: boolean;
        hydratable: boolean;
    };
};

export type ResolvedRelationGraphSnapshotModel = {
    key: string;
    relations: ResolvedRelationGraphSnapshotRelation[];
};

export type ResolvedRelationGraphSnapshot = {
    models: ResolvedRelationGraphSnapshotModel[];
};
