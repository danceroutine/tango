import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, relative } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

import { loadDefaultExport, loadModule } from '../loadModule';

const createdDirs: string[] = [];

async function makeTempDir(prefix: string): Promise<string> {
    const directory = await mkdtemp(join(tmpdir(), prefix));
    createdDirs.push(directory);
    return directory;
}

afterEach(async () => {
    for (const directory of createdDirs.splice(0)) {
        await rm(directory, { recursive: true, force: true });
    }
});

describe('loadModule', () => {
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
});
