/**
 * Domain boundary barrel: centralizes this subdomain's public contract.
 */
export { ModelRegistry } from './ModelRegistry';
export { createSchemaModuleAliases, resolveSchemaModuleEntrypoint } from '../../resolveSchemaModuleEntrypoint';
export {
    GENERATED_RELATION_REGISTRY_DIRNAME,
    GENERATED_RELATION_REGISTRY_METADATA_FILENAME,
    GENERATED_RELATION_REGISTRY_METADATA_VERSION,
    GENERATED_RELATION_REGISTRY_TYPES_FILENAME,
    type GeneratedRelationRegistryArtifact,
} from './GeneratedRelationRegistryArtifact';
export { ResolvedRelationGraphArtifactFactory } from './ResolvedRelationGraphArtifactFactory';
export {
    type ResolvedRelationGraphSnapshot,
    type ResolvedRelationGraphSnapshotModel,
    type ResolvedRelationGraphSnapshotRelation,
} from './ResolvedRelationGraphSnapshot';
