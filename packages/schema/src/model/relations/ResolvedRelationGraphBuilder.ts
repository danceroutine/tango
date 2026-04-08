import type { Model, RelationDef } from '../../domain/index';
import type { FinalizedStorageArtifacts } from '../fields/FinalizedStorageArtifacts';
import { InternalSchemaModel } from '../internal/InternalSchemaModel';
import type { NormalizedRelationStorageDescriptor } from './NormalizedRelationStorageDescriptor';
import type { ResolvedRelationDescriptor, ResolvedRelationGraph } from './ResolvedRelationGraph';
import {
    type RelationCardinality,
    InternalRelationCardinality,
    InternalRelationPublicKind,
    InternalRelationProvenance,
    InternalRelationStorageStrategy,
} from './RelationSpec';
import { pluralize, toSnakeCase } from './SchemaNaming';

const REFERENCE_CAPABILITIES = Object.freeze({
    migratable: true,
    queryable: true,
    hydratable: true,
});
const MANY_TO_MANY_CAPABILITIES = Object.freeze({
    migratable: false,
    queryable: false,
    hydratable: false,
});
const RELATION_NAME_SEPARATOR = ':';

type GraphBuilderOptions = {
    version: number;
    models: readonly Model[];
    storage: FinalizedStorageArtifacts;
    resolveRef: (ref: NormalizedRelationStorageDescriptor['targetRef']) => Model;
};

/**
 * Resolution-stage builder that turns normalized relation descriptors into the
 * registry-scoped resolved relation graph.
 *
 * This is the final pipeline stage in the relations subdomain. It combines:
 *
 * - normalized field-authored relation descriptors
 * - explicit model-level relation names from `RelationBuilder`
 * - finalized storage artifacts from the registry
 *
 * The result is the canonical named relation graph used by ORM-facing
 * consumers.
 */
export class ResolvedRelationGraphBuilder {
    private readonly byModel = new Map<string, Map<string, ResolvedRelationDescriptor>>();
    private readonly byEdgeId = new Map<string, ResolvedRelationDescriptor>();
    private readonly matchedOverrides = new Set<string>();

    constructor(private readonly options: GraphBuilderOptions) {}

    static build(options: GraphBuilderOptions): ResolvedRelationGraph {
        return new ResolvedRelationGraphBuilder(options).build();
    }

    /**
     * Resolve every model's normalized relation descriptors into a single
     * registry-scoped graph and fail when authoring ambiguity remains.
     */
    build(): ResolvedRelationGraph {
        for (const model of this.options.models) {
            this.addModelRelations(model);
        }

        for (const model of this.options.models) {
            this.assertAllOverridesMatched(model);
        }

        return {
            version: this.options.version,
            byModel: this.byModel,
            byEdgeId: this.byEdgeId,
        };
    }

    private addModelRelations(model: Model): void {
        const explicitRelations = InternalSchemaModel.getExplicitRelations(model) ?? {};

        for (const descriptor of InternalSchemaModel.getNormalizedRelations(model)) {
            const targetModel = this.options.resolveRef(descriptor.targetRef);

            if (descriptor.origin === 'manyToMany') {
                const relationName = descriptor.explicitForwardName ?? descriptor.namingHint;
                this.addResolvedRelation({
                    edgeId: descriptor.edgeId,
                    sourceModelKey: model.metadata.key,
                    targetModelKey: targetModel.metadata.key,
                    name: relationName,
                    kind: InternalRelationPublicKind.MANY_TO_MANY,
                    storageStrategy: InternalRelationStorageStrategy.MANY_TO_MANY,
                    cardinality: InternalRelationCardinality.MANY,
                    capabilities: MANY_TO_MANY_CAPABILITIES,
                    provenance: InternalRelationProvenance.FIELD_DECORATOR,
                    alias: `${toSnakeCase(model.metadata.name)}_${relationName}`,
                });
                continue;
            }

            this.addReferenceRelations(model, descriptor, targetModel, explicitRelations);
        }
    }

    private addReferenceRelations(
        sourceModel: Model,
        descriptor: NormalizedRelationStorageDescriptor,
        targetModel: Model,
        explicitRelations: Readonly<Record<string, RelationDef>>
    ): void {
        const forwardOverride = this.findForwardOverride(sourceModel, targetModel, descriptor, explicitRelations);
        if (forwardOverride) {
            this.markOverrideMatched(sourceModel.metadata.key, forwardOverride[0]);
        }

        const forwardName = forwardOverride?.[0] ?? descriptor.explicitForwardName ?? descriptor.namingHint;
        const targetPrimaryKey = this.getPrimaryKey(targetModel.metadata.key);
        this.addResolvedRelation({
            edgeId: descriptor.edgeId,
            sourceModelKey: sourceModel.metadata.key,
            targetModelKey: targetModel.metadata.key,
            name: forwardName,
            inverseEdgeId: `${descriptor.edgeId}:inverse`,
            kind: InternalRelationPublicKind.BELONGS_TO,
            storageStrategy: InternalRelationStorageStrategy.REFERENCE,
            cardinality: InternalRelationCardinality.SINGLE,
            localFieldName: descriptor.dbColumnName,
            targetFieldName: descriptor.referencedTargetColumn ?? targetPrimaryKey,
            capabilities: REFERENCE_CAPABILITIES,
            provenance: InternalRelationProvenance.FIELD_DECORATOR,
            alias: `${toSnakeCase(targetModel.metadata.name)}_${forwardName}`,
        });

        const reverseOverride = this.findReverseOverride(sourceModel, targetModel, descriptor);
        if (reverseOverride) {
            this.markOverrideMatched(targetModel.metadata.key, reverseOverride[0]);
        }

        const reverseKind = descriptor.unique
            ? InternalRelationPublicKind.HAS_ONE
            : InternalRelationPublicKind.HAS_MANY;
        const reverseCardinality = descriptor.unique
            ? InternalRelationCardinality.SINGLE
            : InternalRelationCardinality.MANY;
        const reverseName =
            reverseOverride?.[0] ??
            descriptor.explicitReverseName ??
            this.deriveReverseName(sourceModel, reverseCardinality);
        this.addResolvedRelation({
            edgeId: `${descriptor.edgeId}:inverse`,
            sourceModelKey: targetModel.metadata.key,
            targetModelKey: sourceModel.metadata.key,
            name: reverseName,
            inverseEdgeId: descriptor.edgeId,
            kind: reverseKind,
            storageStrategy: InternalRelationStorageStrategy.REVERSE_REFERENCE,
            cardinality: reverseCardinality,
            localFieldName: descriptor.dbColumnName,
            targetFieldName: descriptor.referencedTargetColumn ?? targetPrimaryKey,
            capabilities: REFERENCE_CAPABILITIES,
            provenance: reverseOverride
                ? InternalRelationProvenance.RELATIONS_API
                : InternalRelationProvenance.SYNTHESIZED_REVERSE,
            alias: `${toSnakeCase(sourceModel.metadata.name)}_${reverseName}`,
        });
    }

    private findForwardOverride(
        sourceModel: Model,
        targetModel: Model,
        descriptor: NormalizedRelationStorageDescriptor,
        explicitRelations: Readonly<Record<string, RelationDef>>
    ): [string, RelationDef] | undefined {
        return Object.entries(explicitRelations).find(([, relation]) => {
            const relationTargetKey = this.resolveRelationTargetKey(sourceModel, relation.target);
            return (
                relation.type === InternalRelationPublicKind.BELONGS_TO &&
                relationTargetKey === targetModel.metadata.key &&
                relation.foreignKey === descriptor.sourceSchemaFieldKey
            );
        });
    }

    private findReverseOverride(
        sourceModel: Model,
        targetModel: Model,
        descriptor: NormalizedRelationStorageDescriptor
    ): [string, RelationDef] | undefined {
        const reverseModelRelations = InternalSchemaModel.getExplicitRelations(targetModel) ?? {};
        const reverseKind = descriptor.unique
            ? InternalRelationPublicKind.HAS_ONE
            : InternalRelationPublicKind.HAS_MANY;
        return Object.entries(reverseModelRelations).find(([, relation]) => {
            const relationTargetKey = this.resolveRelationTargetKey(targetModel, relation.target);
            return (
                relationTargetKey === sourceModel.metadata.key &&
                relation.type === reverseKind &&
                relation.foreignKey === descriptor.sourceSchemaFieldKey
            );
        });
    }

    private assertAllOverridesMatched(model: Model): void {
        const explicitRelations = InternalSchemaModel.getExplicitRelations(model);
        if (!explicitRelations) {
            return;
        }

        for (const relationName of Object.keys(explicitRelations)) {
            const marker = this.buildOverrideMarker(model.metadata.key, relationName);
            if (!this.matchedOverrides.has(marker)) {
                throw new Error(
                    `Relation override '${relationName}' on model '${model.metadata.key}' does not match a field-authored relation.`
                );
            }
        }
    }

    private addResolvedRelation(descriptor: ResolvedRelationDescriptor): void {
        const modelRelations =
            this.byModel.get(descriptor.sourceModelKey) ?? new Map<string, ResolvedRelationDescriptor>();
        const existing = modelRelations.get(descriptor.name);
        if (existing) {
            throw new Error(
                `Ambiguous relation name '${descriptor.name}' on model '${descriptor.sourceModelKey}'. Add an explicit relations override.`
            );
        }

        modelRelations.set(descriptor.name, descriptor);
        this.byModel.set(descriptor.sourceModelKey, modelRelations);
        this.byEdgeId.set(descriptor.edgeId, descriptor);
    }

    private getPrimaryKey(modelKey: string): string {
        return this.options.storage.byModel.get(modelKey)!.pk;
    }

    private markOverrideMatched(modelKey: string, relationName: string): void {
        this.matchedOverrides.add(this.buildOverrideMarker(modelKey, relationName));
    }

    private buildOverrideMarker(modelKey: string, relationName: string): string {
        return `${modelKey}${RELATION_NAME_SEPARATOR}${relationName}`;
    }

    private resolveRelationTargetKey(sourceModel: Model, target: string): string {
        if (target.includes('/')) {
            return target;
        }

        return `${sourceModel.metadata.namespace}/${target}`;
    }

    private deriveReverseName(sourceModel: Model, cardinality: RelationCardinality): string {
        if (sourceModel.metadata.defaultRelatedName) {
            return sourceModel.metadata.defaultRelatedName;
        }

        const snake = toSnakeCase(sourceModel.metadata.name);
        return cardinality === InternalRelationCardinality.MANY ? pluralize(snake) : snake;
    }
}
