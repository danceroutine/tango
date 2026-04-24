import type { RelationCardinality, RelationPublicKind, RelationStorageStrategy } from '../relations/RelationSpec';

/**
 * Serializable snapshot of a single relation edge from the resolved relation
 * graph. Snapshots are the stable, build-time wire format consumed by codegen
 * and by tooling that compares the graph across runs.
 *
 * A snapshot row captures both the abstract edge identity (who connects to
 * whom, under what public name) and the physical storage details (local
 * fields, join columns, through-model coordinates) needed to translate the
 * edge into SQL later.
 */
export type ResolvedRelationGraphSnapshotRelation = {
    /**
     * Stable identifier for this edge within the graph. Used to cross-reference
     * an edge with its inverse and to detect drift between snapshots.
     */
    edgeId: string;

    /** Model key of the endpoint that owns this edge in the resolved graph. */
    sourceModelKey: string;

    /** Model key of the endpoint this edge points at. */
    targetModelKey: string;

    /**
     * Public relation name exposed to application code and query builders
     * (for example `author` or `tags`).
     */
    name: string;

    /**
     * Identifier of the paired edge on the opposite endpoint, when one exists.
     * Bidirectional relations populate this; one-way edges leave it unset.
     */
    inverseEdgeId?: string;

    /**
     * Public relation kind (`belongsTo`, `hasMany`, `manyToMany`, ...).
     */
    kind: RelationPublicKind;

    /**
     * How the edge is physically stored. Distinguishes direct foreign-key
     * references from reverse references and join-table backed relations.
     */
    storageStrategy: RelationStorageStrategy;

    /** Whether the edge yields one target (`single`) or many (`many`). */
    cardinality: RelationCardinality;

    /**
     * Owner-side column that stores the foreign key, when the edge is backed
     * by a local reference column.
     */
    localFieldName?: string;

    /**
     * Target-side column the foreign key resolves against, when applicable.
     */
    targetFieldName?: string;

    /**
     * Model key of the synthesized or user-provided through model for
     * many-to-many edges.
     */
    throughModelKey?: string;

    /** Physical join-table name for many-to-many edges. */
    throughTable?: string;

    /** Through-model schema field on the source side, if resolved. */
    throughSourceFieldName?: string;

    /** Through-model schema field on the target side, if resolved. */
    throughTargetFieldName?: string;

    /**
     * Physical join-table column that stores the owner-side primary key for
     * many-to-many edges.
     */
    throughSourceKey?: string;

    /**
     * Physical join-table column that stores the target-side primary key for
     * many-to-many edges.
     */
    throughTargetKey?: string;

    /**
     * Alias used when the edge participates in SQL joins. Derived
     * deterministically so compiled SQL is stable across runs.
     */
    alias: string;

    /**
     * What this edge is allowed to participate in. The builder uses these
     * flags to decide whether migrations emit DDL, queries can select over
     * the edge, and hydration can populate the related attribute.
     */
    capabilities: {
        /** Whether migration tooling should emit DDL for this edge. */
        migratable: boolean;
        /** Whether the edge can appear as a hop in a query path. */
        queryable: boolean;
        /** Whether hydrators can populate the related attribute on a row. */
        hydratable: boolean;
    };
};

/**
 * Snapshot of one model's relation edges. Grouping edges by source model
 * lets codegen walk the graph model-by-model without having to re-index.
 */
export type ResolvedRelationGraphSnapshotModel = {
    /** Model key these relations source from. */
    key: string;

    /** Resolved outgoing relation edges in registration order. */
    relations: ResolvedRelationGraphSnapshotRelation[];
};

/**
 * Top-level serializable snapshot of the resolved relation graph for a
 * registry. Written to disk by codegen and diffed across runs to detect
 * registry drift.
 */
export type ResolvedRelationGraphSnapshot = {
    /** Per-model relation snapshots in registration order. */
    models: ResolvedRelationGraphSnapshotModel[];
};
