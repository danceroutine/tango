import type { DeleteReferentialAction, UpdateReferentialAction } from '../../domain/index';
import type { ModelRef } from '../decorators/domain/ModelRef';

export const INTERNAL_NORMALIZED_RELATION_ORIGIN = {
    FOREIGN_KEY: 'foreignKey',
    ONE_TO_ONE: 'oneToOne',
    MANY_TO_MANY: 'manyToMany',
} as const;
export type NormalizedRelationOrigin =
    (typeof INTERNAL_NORMALIZED_RELATION_ORIGIN)[keyof typeof INTERNAL_NORMALIZED_RELATION_ORIGIN];

/**
 * Registry-independent relation descriptor produced immediately after model
 * construction.
 *
 * This is the handoff object between relation authoring and relation
 * resolution. It preserves field-authored relation intent in a normalized form
 * without yet assigning public reverse names or resolved graph edges.
 */
export interface NormalizedRelationStorageDescriptor {
    edgeId: string;
    sourceModelKey: string;
    sourceSchemaFieldKey: string;
    targetRef: ModelRef;
    origin: NormalizedRelationOrigin;
    localFieldName: string;
    dbColumnName: string;
    referencedTargetColumn?: string;
    onDelete?: DeleteReferentialAction;
    onUpdate?: UpdateReferentialAction;
    unique?: boolean;
    explicitForwardName?: string;
    explicitReverseName?: string;
    namingHint: string;
    throughModelRef?: ModelRef;
    throughSourceFieldName?: string;
    throughTargetFieldName?: string;
    provenance: 'field-decorator';
}
