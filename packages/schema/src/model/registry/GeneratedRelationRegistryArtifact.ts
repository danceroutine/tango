import type { ResolvedRelationGraphSnapshot } from './ResolvedRelationGraphSnapshot';

// These constants define the current generated-relation artifact contract.
// They are centralized here so codegen, runtime drift checks, and CLI commands
// share one default location and filename scheme.
export const GENERATED_RELATION_REGISTRY_DIRNAME = '.tango';
export const GENERATED_RELATION_REGISTRY_TYPES_FILENAME = 'relations.generated.d.ts';
export const GENERATED_RELATION_REGISTRY_METADATA_FILENAME = 'relations.generated.json';
export const GENERATED_RELATION_REGISTRY_METADATA_VERSION = 1;

export type GeneratedRelationRegistryArtifact = {
    version: typeof GENERATED_RELATION_REGISTRY_METADATA_VERSION;
    fingerprint: string;
    snapshot: ResolvedRelationGraphSnapshot;
};
