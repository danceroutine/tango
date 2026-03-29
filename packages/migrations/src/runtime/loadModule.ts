import { resolve, extname } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createJiti } from 'jiti';

const TS_EXTENSIONS = new Set(['.ts', '.tsx', '.mts', '.cts']);

function toAbsolutePath(modulePath: string, projectRoot: string): string {
    return resolve(projectRoot, modulePath);
}

function isTypeScriptModule(modulePath: string): boolean {
    return TS_EXTENSIONS.has(extname(modulePath).toLowerCase());
}

/**
 * Load a module from a Tango app project root.
 *
 * TypeScript modules are loaded through jiti and JavaScript/ESM modules are loaded
 * through native dynamic import so published installs behave like end-user runtime.
 */
export async function loadModule(
    modulePath: string,
    options?: { projectRoot?: string }
): Promise<Record<string, unknown>> {
    const projectRoot = options?.projectRoot ?? process.cwd();
    const absolutePath = toAbsolutePath(modulePath, projectRoot);

    if (isTypeScriptModule(absolutePath)) {
        const jiti = createJiti(resolve(projectRoot, 'tango.config.ts'), {
            interopDefault: true,
            moduleCache: true,
        });
        return (await jiti.import<Record<string, unknown>>(absolutePath)) as Record<string, unknown>;
    }

    return (await import(pathToFileURL(absolutePath).href)) as Record<string, unknown>;
}

/**
 * Load a module and return default export when present.
 */
export async function loadDefaultExport(modulePath: string, options?: { projectRoot?: string }): Promise<unknown> {
    const loaded = await loadModule(modulePath, options);
    return loaded.default ?? loaded;
}
