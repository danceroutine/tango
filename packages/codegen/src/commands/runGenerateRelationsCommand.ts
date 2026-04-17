import { resolve } from 'node:path';
import { getLogger } from '@danceroutine/tango-core';
import {
    GENERATED_RELATION_REGISTRY_DIRNAME,
    GENERATED_RELATION_REGISTRY_METADATA_FILENAME,
    GENERATED_RELATION_REGISTRY_TYPES_FILENAME,
} from '@danceroutine/tango-schema';
import type { Argv } from 'yargs';
import { writeRelationRegistryArtifacts } from '../generators/relations';
import { loadProjectModule } from './loadProjectModule';

const logger = getLogger('tango.codegen');

type GenerateRelationsCommandArgs = {
    models: string;
    outDir: string;
};

/**
 * Generate the app-local ambient relation registry from a finalized model graph.
 */
export async function runGenerateRelationsCommand({ models, outDir }: GenerateRelationsCommandArgs): Promise<void> {
    const outputDir = resolve(process.cwd(), outDir);
    const { registry, modelTypeAccessors } = await loadProjectModule(models, { outputDir });
    const written = await writeRelationRegistryArtifacts({
        registry,
        modelTypeAccessors,
        outputDir,
    });

    logger.info(`Generated relation registry: ${written.typesFilepath}`);
    logger.info(`Generated relation metadata: ${written.metadataFilepath}`);
}

export function withGenerateRelationsCommand(parser: Argv): Argv {
    return parser.command(
        'relations',
        'Generate app-local ambient relation typing from Tango models',
        (builder) =>
            builder
                .option('models', {
                    type: 'string',
                    demandOption: true,
                    describe: 'Path to the module exporting Tango Model definitions.',
                })
                .option('out-dir', {
                    type: 'string',
                    default: GENERATED_RELATION_REGISTRY_DIRNAME,
                    describe: `Directory that receives ${GENERATED_RELATION_REGISTRY_TYPES_FILENAME} and ${GENERATED_RELATION_REGISTRY_METADATA_FILENAME}.`,
                }),
        async ({ models, outDir }) => {
            await runGenerateRelationsCommand({
                models,
                outDir,
            });
        }
    );
}
