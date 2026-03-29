import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { createJiti } from 'jiti';
import type { LoadedConfig } from './LoadedConfig';
import { loadConfig } from './loadConfig';

const DEFAULT_CONFIG_FILENAMES = [
    'tango.config.ts',
    'tango.config.mts',
    'tango.config.cts',
    'tango.config.js',
    'tango.config.mjs',
    'tango.config.cjs',
] as const;

export interface ProjectConfigLoadOptions {
    projectRoot?: string;
    configPath?: string;
}

function resolveConfigPath(projectRoot: string, explicitPath?: string): string {
    if (explicitPath) {
        const absolutePath = resolve(projectRoot, explicitPath);
        if (!existsSync(absolutePath)) {
            throw new Error(`Unable to find Tango config at '${absolutePath}'.`);
        }
        return absolutePath;
    }

    for (const filename of DEFAULT_CONFIG_FILENAMES) {
        const absolutePath = resolve(projectRoot, filename);
        if (existsSync(absolutePath)) {
            return absolutePath;
        }
    }

    throw new Error(
        `Unable to find Tango config in '${projectRoot}'. Expected one of: ${DEFAULT_CONFIG_FILENAMES.join(', ')}.`
    );
}

/**
 * Resolve, load, and validate `tango.config.*` from a project root.
 */
export function loadConfigFromProjectRoot(options: ProjectConfigLoadOptions = {}): LoadedConfig {
    const projectRoot = options.projectRoot ?? process.cwd();
    const configPath = resolveConfigPath(projectRoot, options.configPath);
    const jiti = createJiti(resolve(projectRoot, 'package.json'), {
        interopDefault: true,
        moduleCache: true,
    });
    const loaded = jiti(configPath);

    return loadConfig(() => loaded);
}
