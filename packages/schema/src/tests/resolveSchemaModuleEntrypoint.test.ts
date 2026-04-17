import { existsSync } from 'node:fs';
import { afterEach, describe, expect, it, vi } from 'vitest';

async function importResolver() {
    return import('../resolveSchemaModuleEntrypoint');
}

afterEach(() => {
    vi.restoreAllMocks();
    vi.doUnmock('node:fs');
    vi.resetModules();
});

describe(importResolver, () => {
    it('returns the current schema package entrypoint', async () => {
        const { resolveSchemaModuleEntrypoint } = await importResolver();
        const resolved = resolveSchemaModuleEntrypoint();

        expect(existsSync(resolved)).toBe(true);
        expect(
            resolved.endsWith('/packages/schema/src/index.ts') || resolved.endsWith('/packages/schema/dist/index.js')
        ).toBe(true);
    });

    it('throws when neither local source nor local dist entrypoint exists', async () => {
        vi.doMock('node:fs', async () => {
            const actual = await vi.importActual<typeof import('node:fs')>('node:fs');
            return {
                ...actual,
                existsSync: () => false,
            };
        });

        const { resolveSchemaModuleEntrypoint } = await importResolver();

        expect(() => resolveSchemaModuleEntrypoint()).toThrow(
            /Unable to resolve the @danceroutine\/tango-schema entrypoint/i
        );
    });

    it('builds aliases for the package root and public subpaths', async () => {
        const { createSchemaModuleAliases } = await importResolver();
        const aliases = createSchemaModuleAliases();

        expect(aliases).toMatchObject({
            '@danceroutine/tango-schema': expect.stringMatching(/\/packages\/schema\/(src|dist)\/index\.(ts|js)$/),
            '@danceroutine/tango-schema/model': expect.stringMatching(
                /\/packages\/schema\/(src|dist)\/model\/index\.(ts|js)$/
            ),
            '@danceroutine/tango-schema/domain': expect.stringMatching(
                /\/packages\/schema\/(src|dist)\/domain\/index\.(ts|js)$/
            ),
        });
        expect(aliases['@danceroutine/tango-schema/']).toMatch(/\/packages\/schema\/(src|dist)\/$/);
    });

    it('throws when model or domain subpath entrypoints are missing', async () => {
        vi.doMock('node:fs', async () => {
            const actual = await vi.importActual<typeof import('node:fs')>('node:fs');
            return {
                ...actual,
                existsSync: (path: string) => !path.endsWith('/model/index.ts') && !path.endsWith('/domain/index.ts'),
            };
        });

        const { createSchemaModuleAliases } = await importResolver();

        expect(() => createSchemaModuleAliases()).toThrow(
            /Unable to resolve the @danceroutine\/tango-schema subpath entrypoints/i
        );
    });
});
