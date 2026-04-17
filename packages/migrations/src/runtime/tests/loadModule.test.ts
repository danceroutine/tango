import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, relative } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { withGlobalTestApi } from '@danceroutine/tango-testing';
import { Model, ModelRegistry, t } from '@danceroutine/tango-schema';

import { loadDefaultExport, loadModule } from '../loadModule';

const createdDirs: string[] = [];

async function makeTempDir(prefix: string): Promise<string> {
    const directory = await mkdtemp(join(tmpdir(), prefix));
    createdDirs.push(directory);
    return directory;
}

afterEach(async () => {
    vi.restoreAllMocks();
    vi.doUnmock('jiti');
    vi.resetModules();

    for (const directory of createdDirs.splice(0)) {
        await rm(directory, { recursive: true, force: true });
    }
});

describe(loadModule, () => {
    it('loads JavaScript modules using the provided project root and supports default exports', async () => {
        const directory = await makeTempDir('tango-load-module-js-');
        const filename = join(directory, 'mod.mjs');
        await writeFile(filename, "export const value = 42;\nexport default { source: 'js' };\n", 'utf8');

        const loaded = await loadModule('./mod.mjs', { projectRoot: directory });
        expect(loaded.value).toBe(42);

        const defaultExport = await loadDefaultExport('./mod.mjs', { projectRoot: directory });
        expect(defaultExport).toEqual({ source: 'js' });
    });

    it('loads TypeScript modules from process.cwd and falls back to the full module when no default exists', async () => {
        const directory = await makeTempDir('tango-load-module-ts-');
        const filename = join(directory, 'mod.ts');
        await writeFile(filename, 'export const value = 7;\n', 'utf8');
        const relativePath = relative(process.cwd(), filename);

        const loaded = await loadModule(relativePath);
        expect(loaded.value).toBe(7);

        const defaultExport = await loadDefaultExport(relativePath);
        expect(defaultExport).toEqual({ value: 7 });
    });

    it('falls back to the full JavaScript module when no default export is present', async () => {
        const directory = await makeTempDir('tango-load-module-js-nodefault-');
        const filename = join(directory, 'mod.mjs');
        await writeFile(filename, 'export const onlyNamed = true;\n', 'utf8');

        const defaultExport = await loadDefaultExport('./mod.mjs', { projectRoot: directory });
        expect(defaultExport).toMatchObject({ onlyNamed: true });
        expect(defaultExport).not.toHaveProperty('default');
    });

    it('loads modules with an explicit registry-bound model construction context', async () => {
        const directory = await makeTempDir('tango-load-module-registry-');
        const filename = join(directory, 'mod.ts');
        await writeFile(
            filename,
            [
                "import { z } from 'zod';",
                'const { Model, t } = globalThis.__tangoLoadModuleTestApi;',
                'export const UserModel = Model({',
                "  namespace: 'load_module',",
                "  name: 'User',",
                '  schema: z.object({ id: t.primaryKey(z.number().int()) }),',
                '});',
            ].join('\n'),
            'utf8'
        );
        const relativePath = relative(process.cwd(), filename);
        const registry = new ModelRegistry();

        await withGlobalTestApi('__tangoLoadModuleTestApi', { Model, t }, async () => {
            const loaded = await loadModule(relativePath, {
                registry,
                moduleCache: false,
                projectRoot: process.cwd(),
            });
            const userModel = loaded.UserModel as { metadata: { key: string } };

            expect(registry.getByKey(userModel.metadata.key)).toBe(userModel);
            expect(ModelRegistry.getOwner(userModel as never)).toBe(registry);
        });
    });

    it('configures jiti without schema-specific aliases', async () => {
        const createJiti = vi.fn((..._args: unknown[]) => ({
            import: vi.fn(async () => ({ default: { ok: true } })),
        }));
        vi.doMock('jiti', () => ({ createJiti }));

        const directory = await makeTempDir('tango-load-module-alias-');
        const { loadModule: importLoadModule } = await import('../loadModule');
        const loaded = await importLoadModule('./mod.ts', { projectRoot: directory, moduleCache: false });

        expect(loaded).toEqual({ default: { ok: true } });
        const options = createJiti.mock.calls.at(0)?.[1] as Record<string, unknown> | undefined;
        expect(options).toMatchObject({
            moduleCache: false,
        });
        expect(options).not.toHaveProperty('alias');
    });
});
