import { existsSync } from 'node:fs';
import { dirname, extname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const LOCAL_ENTRYPOINT_CANDIDATES = ['./index.ts', './index.js'] as const;

/**
 * Resolve the current package root entrypoint for `@danceroutine/tango-schema`.
 *
 * Tooling loaders alias app-side `@danceroutine/tango-schema` imports back to
 * this path so project modules reuse the same schema package instance across
 * workspace-source and published-dist environments.
 */
export function resolveSchemaModuleEntrypoint(): string {
    for (const relativePath of LOCAL_ENTRYPOINT_CANDIDATES) {
        const absolutePath = fileURLToPath(new URL(relativePath, import.meta.url));
        if (existsSync(absolutePath)) {
            return absolutePath;
        }
    }

    throw new Error(
        `Unable to resolve the @danceroutine/tango-schema entrypoint relative to '${fileURLToPath(import.meta.url)}'.`
    );
}

/**
 * Return explicit Jiti alias entries for the schema package root and its
 * public subpaths so app modules always reuse the same schema package instance.
 *
 * @internal
 * Exported for Tango tooling/framework consumption only. This helper exists so
 * Tango loaders can force app modules to reuse the active schema package
 * instance during module execution. It is not intended as a stable application
 * API, and the alias map may be more permissive than the package exports
 * surface by design.
 */
export function createSchemaModuleAliases(): Record<string, string> {
    const entrypoint = resolveSchemaModuleEntrypoint();
    const packageRoot = dirname(entrypoint);
    const extension = extname(entrypoint);
    const modelEntrypoint = resolve(packageRoot, 'model', `index${extension}`);
    const domainEntrypoint = resolve(packageRoot, 'domain', `index${extension}`);

    if (!existsSync(modelEntrypoint) || !existsSync(domainEntrypoint)) {
        throw new Error(
            `Unable to resolve the @danceroutine/tango-schema subpath entrypoints relative to '${entrypoint}'.`
        );
    }

    return {
        '@danceroutine/tango-schema': entrypoint,
        '@danceroutine/tango-schema/model': modelEntrypoint,
        '@danceroutine/tango-schema/domain': domainEntrypoint,
        // Deliberately permissive for tooling-time identity unification. This
        // is not intended to widen the package's supported end-user API.
        '@danceroutine/tango-schema/': `${packageRoot}/`,
    };
}
