// Keep these as plain string literals rather than TS enums so the runtime
// values stay identical across package boundaries without enum emit semantics.
export const INTERNAL_RELATION_PUBLIC_KIND = {
    BELONGS_TO: 'belongsTo',
    HAS_ONE: 'hasOne',
    HAS_MANY: 'hasMany',
    MANY_TO_MANY: 'manyToMany',
} as const;

export const INTERNAL_RELATION_STORAGE_STRATEGY = {
    REFERENCE: 'reference',
    REVERSE_REFERENCE: 'reverse_reference',
    MANY_TO_MANY: 'many_to_many',
} as const;

export const INTERNAL_RELATION_CARDINALITY = {
    SINGLE: 'single',
    MANY: 'many',
} as const;

export const INTERNAL_RELATION_PROVENANCE = {
    FIELD_DECORATOR: 'field-decorator',
    RELATIONS_API: 'relations-api',
    SYNTHESIZED_REVERSE: 'synthesized-reverse',
} as const;

export type RelationPublicKind = (typeof INTERNAL_RELATION_PUBLIC_KIND)[keyof typeof INTERNAL_RELATION_PUBLIC_KIND];
export type RelationStorageStrategy =
    (typeof INTERNAL_RELATION_STORAGE_STRATEGY)[keyof typeof INTERNAL_RELATION_STORAGE_STRATEGY];
export type RelationCardinality = (typeof INTERNAL_RELATION_CARDINALITY)[keyof typeof INTERNAL_RELATION_CARDINALITY];
export type RelationProvenance = (typeof INTERNAL_RELATION_PROVENANCE)[keyof typeof INTERNAL_RELATION_PROVENANCE];

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
