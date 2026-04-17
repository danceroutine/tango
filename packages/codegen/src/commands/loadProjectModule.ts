import { extname, relative, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createJiti } from 'jiti';
import { ModelRegistry } from '@danceroutine/tango-schema';

const TS_EXTENSIONS = new Set(['.ts', '.tsx', '.mts', '.cts']);

type ProjectModuleLoadResult = {
    loaded: Record<string, unknown>;
    modelTypeAccessors: Record<string, string>;
    registry: ModelRegistry;
};

type ModelLike = { metadata: { key: string } };
type CollectedModelAccessors = {
    accessors: Record<string, string>;
    models: ModelLike[];
};

function isTypeScriptModule(modulePath: string): boolean {
    return TS_EXTENSIONS.has(extname(modulePath).toLowerCase());
}

function isModelLike(value: unknown): value is ModelLike {
    return (
        typeof value === 'object' &&
        value !== null &&
        'metadata' in value &&
        typeof (value as { metadata?: { key?: unknown } }).metadata?.key === 'string'
    );
}

function toImportSpecifier(absoluteModulePath: string, outputDir: string): string {
    const relativePath = relative(outputDir, absoluteModulePath).replaceAll('\\', '/');
    return relativePath.startsWith('.') ? relativePath : `./${relativePath}`;
}

function collectModelTypeAccessors(
    loaded: Record<string, unknown>,
    importSpecifier: string,
    accessors: Map<string, string> = new Map()
): CollectedModelAccessors {
    const models: ModelLike[] = [];

    const registerAccessor = (model: ModelLike, accessor: string): void => {
        models.push(model);
        const existing = accessors.get(model.metadata.key);
        if (!existing || accessor.length < existing.length) {
            accessors.set(model.metadata.key, accessor);
        }
    };

    const inspectValue = (value: unknown, accessorSegments: readonly string[]): void => {
        if (isModelLike(value)) {
            const accessor = accessorSegments.map((segment) => `[${JSON.stringify(segment)}]`).join('');
            registerAccessor(value, `typeof import(${JSON.stringify(importSpecifier)})${accessor}`);
            return;
        }

        if (typeof value !== 'object' || value === null) {
            return;
        }

        for (const [key, nested] of Object.entries(value)) {
            if (isModelLike(nested)) {
                const accessor = [...accessorSegments, key].map((segment) => `[${JSON.stringify(segment)}]`).join('');
                registerAccessor(nested, `typeof import(${JSON.stringify(importSpecifier)})${accessor}`);
            }
        }
    };

    for (const [key, value] of Object.entries(loaded)) {
        inspectValue(value, [key]);
    }

    return {
        accessors: Object.fromEntries(accessors),
        models,
    };
}

/**
 * Load a Tango app module and discover model export accessors suitable for
 * generated ambient type references.
 */
export async function loadProjectModule(
    modulePath: string,
    options?: { projectRoot?: string; outputDir?: string }
): Promise<ProjectModuleLoadResult> {
    const projectRoot = options?.projectRoot ?? process.cwd();
    const absoluteModulePath = resolve(projectRoot, modulePath);
    const outputDir = options?.outputDir ?? resolve(projectRoot, '.tango');
    const registry = new ModelRegistry();

    const executeImport = async (): Promise<Record<string, unknown>> => {
        if (isTypeScriptModule(absoluteModulePath)) {
            const jiti = createJiti(resolve(projectRoot, 'tango.config.ts'), {
                interopDefault: true,
                moduleCache: false,
            });
            return (await jiti.import<Record<string, unknown>>(absoluteModulePath)) as Record<string, unknown>;
        }

        return (await import(pathToFileURL(absoluteModulePath).href)) as Record<string, unknown>;
    };

    const loaded = await ModelRegistry.runWithRegistry(registry, executeImport);
    const collected = collectModelTypeAccessors(loaded, toImportSpecifier(absoluteModulePath, outputDir));
    const effectiveRegistry =
        registry.values().length > 0
            ? registry
            : collected.models.length > 0
              ? (ModelRegistry.getOwner(collected.models[0] as never) as ModelRegistry)
              : registry;

    return {
        loaded,
        modelTypeAccessors: collected.accessors,
        registry: effectiveRegistry,
    };
}
