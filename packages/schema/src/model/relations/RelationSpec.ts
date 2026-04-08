// Keep these as plain string literals rather than TS enums so the runtime
// values stay identical across package boundaries without enum emit semantics.
export const InternalRelationPublicKind = {
    BELONGS_TO: 'belongsTo',
    HAS_ONE: 'hasOne',
    HAS_MANY: 'hasMany',
    MANY_TO_MANY: 'manyToMany',
} as const;

export const InternalRelationStorageStrategy = {
    REFERENCE: 'reference',
    REVERSE_REFERENCE: 'reverse_reference',
    MANY_TO_MANY: 'many_to_many',
} as const;

export const InternalRelationCardinality = {
    SINGLE: 'single',
    MANY: 'many',
} as const;

export const InternalRelationProvenance = {
    FIELD_DECORATOR: 'field-decorator',
    RELATIONS_API: 'relations-api',
    SYNTHESIZED_REVERSE: 'synthesized-reverse',
} as const;

export type RelationPublicKind = (typeof InternalRelationPublicKind)[keyof typeof InternalRelationPublicKind];
export type RelationStorageStrategy =
    (typeof InternalRelationStorageStrategy)[keyof typeof InternalRelationStorageStrategy];
export type RelationCardinality = (typeof InternalRelationCardinality)[keyof typeof InternalRelationCardinality];
export type RelationProvenance = (typeof InternalRelationProvenance)[keyof typeof InternalRelationProvenance];

/**
 * Author-time relation intent after target resolution but before full graph
 * pairing and naming.
 *
 * This type is the conceptual bridge between normalized descriptors and the
 * fully resolved graph. It exists so the relations subdomain has a stable
 * vocabulary for relation kinds, storage strategies, and provenance as the
 * pipeline becomes more sophisticated.
 */
export interface RelationSpec {
    edgeId: string;
    sourceModelKey: string;
    sourceSchemaFieldKey?: string;
    targetModelKey: string;
    kind: RelationPublicKind;
    storageStrategy: RelationStorageStrategy;
    localFieldName?: string;
    targetFieldName?: string;
    nameHint?: string;
    throughModelKey?: string;
    throughSourceFieldName?: string;
    throughTargetFieldName?: string;
    provenance: RelationProvenance;
}
