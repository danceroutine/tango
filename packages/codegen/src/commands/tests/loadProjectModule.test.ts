import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { z } from 'zod';
import { Model, ModelRegistry, t } from '@danceroutine/tango-schema';
import { afterEach, describe, expect, it, vi } from 'vitest';

const createdDirs: string[] = [];

async function makeTempDir(prefix: string): Promise<string> {
    const directory = await mkdtemp(join(tmpdir(), prefix));
    createdDirs.push(directory);
    return directory;
}

async function importLoadProjectModule() {
    return import('../loadProjectModule');
}

afterEach(async () => {
    vi.restoreAllMocks();
    vi.doUnmock('jiti');
    vi.resetModules();

    for (const directory of createdDirs.splice(0)) {
        await rm(directory, { recursive: true, force: true });
    }
});

describe(importLoadProjectModule, () => {
    it('loads TypeScript modules and discovers direct and nested model accessors', async () => {
        const directory = await makeTempDir('tango-codegen-load-project-module-ts-');
        const createJiti = vi.fn((..._args: unknown[]) => ({
            import: vi.fn(async () => {
                const UserModel = Model({
                    namespace: 'blog',
                    name: 'User',
                    table: 'users',
                    schema: z.object({
                        id: t.primaryKey(z.number().int()),
                    }),
                });
                const ProfileModel = Model({
                    namespace: 'blog',
                    name: 'Profile',
                    table: 'profiles',
                    schema: z.object({
                        id: t.primaryKey(z.number().int()),
                        userId: t.foreignKey('blog/User', {
                            field: z.number().int(),
                            relatedName: 'profiles',
                        }),
                    }),
                });

                return {
                    version: 1,
                    UserModel,
                    groups: { ProfileModel, UserModel, version: 1 },
                };
            }),
        }));
        vi.doMock('jiti', () => ({ createJiti }));

        const { loadProjectModule } = await importLoadProjectModule();
        const result = await loadProjectModule('./src/models.ts', {
            projectRoot: directory,
            outputDir: directory,
        });

        expect(result.loaded.version).toBe(1);
        expect(result.modelTypeAccessors).toEqual({
            'blog/Profile': 'typeof import("./src/models.ts")["groups"]["ProfileModel"]',
            'blog/User': 'typeof import("./src/models.ts")["UserModel"]',
        });
        expect(
            result.registry
                .values()
                .map((model) => model.metadata.key)
                .sort()
        ).toEqual(['blog/Profile', 'blog/User']);
        const options = createJiti.mock.calls.at(0)?.[1] as Record<string, unknown> | undefined;
        expect(options).toMatchObject({ moduleCache: false });
    });

    it('loads JavaScript modules through native dynamic import when the module is not TypeScript', async () => {
        const directory = await makeTempDir('tango-codegen-load-project-module-js-');
        const filename = join(directory, 'src/models.mjs');
        await mkdir(join(directory, 'src'), { recursive: true });
        await writeFile(filename, 'export const value = 42;\n', 'utf8');

        const { loadProjectModule } = await importLoadProjectModule();
        const result = await loadProjectModule('./src/models.mjs', {
            projectRoot: directory,
            outputDir: join(directory, '.tango'),
        });

        expect(result.loaded.value).toBe(42);
        expect(result.modelTypeAccessors).toEqual({});
        expect(result.registry.values()).toEqual([]);
    });

    it('configures jiti without schema-specific aliases', async () => {
        const createJiti = vi.fn((..._args: unknown[]) => ({
            import: vi.fn(async () => ({})),
        }));
        vi.doMock('jiti', () => ({ createJiti }));

        const directory = await makeTempDir('tango-codegen-load-project-module-alias-');
        const { loadProjectModule } = await importLoadProjectModule();
        await loadProjectModule('./src/models.ts', { projectRoot: directory });

        expect(createJiti).toHaveBeenCalledOnce();
        const options = createJiti.mock.calls.at(0)?.[1] as Record<string, unknown> | undefined;
        expect(options).toMatchObject({
            moduleCache: false,
        });
        expect(options).not.toHaveProperty('alias');
    });

    it('falls back to the loaded model owner when the active registry remains empty', async () => {
        const createJiti = vi.fn((..._args: unknown[]) => ({
            import: vi.fn(async () => {
                const foreignRegistry = new ModelRegistry();
                const ForeignUserModel = Model({
                    registry: foreignRegistry,
                    namespace: 'blog',
                    name: 'ForeignUser',
                    table: 'users',
                    schema: z.object({
                        id: t.primaryKey(z.number().int()),
                    }),
                });

                return {
                    ForeignUserModel,
                };
            }),
        }));
        vi.doMock('jiti', () => ({ createJiti }));

        const directory = await makeTempDir('tango-codegen-load-project-module-foreign-owner-');
        const { loadProjectModule } = await importLoadProjectModule();
        const result = await loadProjectModule('./src/models.ts', {
            projectRoot: directory,
            outputDir: directory,
        });

        expect(result.registry.getByKey('blog/ForeignUser')).toBe(result.loaded.ForeignUserModel);
        expect(result.modelTypeAccessors).toEqual({
            'blog/ForeignUser': 'typeof import("./src/models.ts")["ForeignUserModel"]',
        });
    });
});
