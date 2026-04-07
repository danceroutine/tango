import { z } from 'zod';
import type { ZodTypeAny } from '../decorators/domain/ZodTypeAny';
import { InternalDecoratedFieldKind } from '../decorators/domain/DecoratedFieldKind';
import { getFieldMetadata } from '../fields/FieldMetadataStore';
import type {
    NormalizedRelationOrigin,
    NormalizedRelationStorageDescriptor,
} from './NormalizedRelationStorageDescriptor';

type RelationCandidate = {
    sourceSchemaFieldKey: string;
    zodType: ZodTypeAny;
};

/**
 * Normalizes field-authored relation declarations from a model schema into the
 * shared descriptor shape consumed by storage and relation finalization.
 *
 * This is the normalization stage of the relations subdomain. It sits between
 * authoring and resolution:
 *
 * - authoring: decorators attach relation intent to schema fields
 * - normalization: this class converts that intent into a registry-independent
 *   descriptor shape
 * - resolution: the graph builder combines those descriptors with finalized
 *   storage artifacts and explicit relation names
 */
export class RelationDescriptorNormalizer {
    constructor(
        private readonly sourceModelKey: string,
        private readonly schema: z.ZodObject<z.ZodRawShape>
    ) {}

    static normalize(
        sourceModelKey: string,
        schema: z.ZodObject<z.ZodRawShape>
    ): readonly NormalizedRelationStorageDescriptor[] {
        return new RelationDescriptorNormalizer(sourceModelKey, schema).normalize();
    }

    /**
     * Run the field-authored relation normalization pipeline for one model
     * schema and emit descriptors that later relation stages can resolve.
     */
    normalize(): readonly NormalizedRelationStorageDescriptor[] {
        const descriptors: NormalizedRelationStorageDescriptor[] = [];

        for (const candidate of this.collectRelationCandidates()) {
            const descriptor = this.normalizeCandidate(candidate);
            if (descriptor) {
                descriptors.push(descriptor);
            }
        }

        return descriptors;
    }

    private collectRelationCandidates(): readonly RelationCandidate[] {
        return Object.entries(this.schema.shape).map(([sourceSchemaFieldKey, zodType]) => ({
            sourceSchemaFieldKey,
            zodType: zodType as ZodTypeAny,
        }));
    }

    private normalizeCandidate(candidate: RelationCandidate): NormalizedRelationStorageDescriptor | undefined {
        const meta = getFieldMetadata(candidate.zodType);
        if (!meta?.references || !meta.relationKind) {
            return undefined;
        }

        return {
            edgeId: this.buildEdgeId(candidate.sourceSchemaFieldKey, meta.relationKind),
            sourceModelKey: this.sourceModelKey,
            sourceSchemaFieldKey: candidate.sourceSchemaFieldKey,
            targetRef: meta.references.target,
            origin: meta.relationKind,
            localFieldName: candidate.sourceSchemaFieldKey,
            dbColumnName: meta.dbColumn ?? candidate.sourceSchemaFieldKey,
            referencedTargetColumn: meta.references.options?.column,
            onDelete: meta.references.options?.onDelete,
            onUpdate: meta.references.options?.onUpdate,
            unique: meta.unique || meta.relationKind === InternalDecoratedFieldKind.ONE_TO_ONE,
            explicitForwardName: meta.forwardName,
            explicitReverseName: meta.reverseName,
            namingHint: this.deriveNamingHint(candidate.sourceSchemaFieldKey),
            provenance: 'field-decorator',
        };
    }

    private buildEdgeId(sourceSchemaFieldKey: string, origin: NormalizedRelationOrigin): string {
        return `${this.sourceModelKey}:${sourceSchemaFieldKey}:${origin}`;
    }

    private deriveNamingHint(fieldKey: string): string {
        if (fieldKey.endsWith('Id') && fieldKey.length > 2) {
            return fieldKey.slice(0, -2);
        }

        if (fieldKey.endsWith('_id') && fieldKey.length > 3) {
            return fieldKey.slice(0, -3);
        }

        return fieldKey;
    }
}
