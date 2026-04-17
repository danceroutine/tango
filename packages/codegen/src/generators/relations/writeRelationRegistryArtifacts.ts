import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import {
    GENERATED_RELATION_REGISTRY_DIRNAME,
    GENERATED_RELATION_REGISTRY_METADATA_FILENAME,
    GENERATED_RELATION_REGISTRY_TYPES_FILENAME,
    type ModelRegistry,
} from '@danceroutine/tango-schema';
import { generateRelationRegistryArtifacts } from './generateRelationRegistryArtifacts';

export type WriteRelationRegistryArtifactsInput = {
    registry: ModelRegistry;
    modelTypeAccessors: Readonly<Record<string, string>>;
    outputDir?: string;
};

export type WrittenRelationRegistryArtifacts = {
    outputDir: string;
    typesFilepath: string;
    metadataFilepath: string;
    fingerprint: string;
};

/**
 * Write the generated relation typing declaration and metadata files to disk.
 */
export async function writeRelationRegistryArtifacts({
    registry,
    modelTypeAccessors,
    outputDir = resolve(process.cwd(), GENERATED_RELATION_REGISTRY_DIRNAME),
}: WriteRelationRegistryArtifactsInput): Promise<WrittenRelationRegistryArtifacts> {
    const snapshot = registry.getResolvedRelationGraphSnapshot();
    const fingerprint = registry.getResolvedRelationGraphFingerprint();
    const artifacts = generateRelationRegistryArtifacts({
        snapshot,
        fingerprint,
        modelTypeAccessors,
    });

    await mkdir(outputDir, { recursive: true });

    const typesFilepath = resolve(outputDir, GENERATED_RELATION_REGISTRY_TYPES_FILENAME);
    const metadataFilepath = resolve(outputDir, GENERATED_RELATION_REGISTRY_METADATA_FILENAME);

    await writeFile(typesFilepath, artifacts.declaration, 'utf8');
    await writeFile(metadataFilepath, `${JSON.stringify(artifacts.metadata, null, 2)}\n`, 'utf8');

    return {
        outputDir,
        typesFilepath,
        metadataFilepath,
        fingerprint,
    };
}
