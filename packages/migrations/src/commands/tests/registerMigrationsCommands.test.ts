import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import yargs from 'yargs';
import { afterEach, describe, expect, it, vi } from 'vitest';

const warnings: string[] = [];
const createdDirs: string[] = [];
const LOAD_COUNT_KEY = '__tangoMigrationsLoadCount';

type LoadCounterGlobal = typeof globalThis & {
    [LOAD_COUNT_KEY]?: number;
};

vi.mock('@danceroutine/tango-core', async () => {
    const actual = await vi.importActual<typeof import('@danceroutine/tango-core')>('@danceroutine/tango-core');
    return {
        ...actual,
        getLogger: () => ({
            error: () => {},
            warn: (message: string) => warnings.push(message),
            info: () => {},
            debug: () => {},
        }),
    };
});

async function importRegisterMigrationsCommands() {
    return (await import('../cli')).registerMigrationsCommands;
}

async function makeTempDir(prefix: string): Promise<string> {
    const directory = await mkdtemp(join(process.cwd(), `.${prefix}`));
    createdDirs.push(directory);
    return directory;
}

async function writeModelsFile(root: string, source: string): Promise<void> {
    await mkdir(join(root, 'src'), { recursive: true });
    await writeFile(join(root, 'src/models.ts'), source, 'utf8');
}

async function writeConfigFile(root: string): Promise<void> {
    await writeFile(
        join(root, 'tango.config.ts'),
        `
        export default {
            current: 'development',
            environments: {
                development: {
                    name: 'development',
                    db: {
                        adapter: 'sqlite',
                        filename: ':memory:',
                        maxConnections: 1,
                    },
                    migrations: { dir: './migrations', online: false },
                },
                test: {
                    name: 'test',
                    db: {
                        adapter: 'sqlite',
                        filename: ':memory:',
                        maxConnections: 1,
                    },
                    migrations: { dir: './migrations', online: false },
                },
                production: {
                    name: 'production',
                    db: {
                        adapter: 'sqlite',
                        filename: ':memory:',
                        maxConnections: 1,
                    },
                    migrations: { dir: './migrations', online: false },
                },
            },
        };
        `,
        'utf8'
    );
}

async function runMakeMigrations(root: string): Promise<void> {
    const cwdBefore = process.cwd();
    process.chdir(root);

    try {
        const registerMigrationsCommands = await importRegisterMigrationsCommands();
        const parser = registerMigrationsCommands(
            yargs(['make:migrations', '--models', './src/models.ts', '--name', 'initial', '--dir', './migrations'])
        );
        await parser.parseAsync();
    } finally {
        process.chdir(cwdBefore);
    }
}

afterEach(async () => {
    warnings.length = 0;
    delete (globalThis as LoadCounterGlobal)[LOAD_COUNT_KEY];
    vi.resetModules();

    for (const directory of createdDirs.splice(0)) {
        await rm(directory, { recursive: true, force: true });
    }
});

describe(importRegisterMigrationsCommands, () => {
    it('loads the models module once while refreshing relation artifacts', async () => {
        const root = await makeTempDir('tango-migrations-cli-');
        await writeConfigFile(root);
        await writeModelsFile(
            root,
            `
            import { Model, t } from '@danceroutine/tango-schema';
            import { z } from 'zod';

            (globalThis as typeof globalThis & { __tangoMigrationsLoadCount?: number }).__tangoMigrationsLoadCount =
                ((globalThis as typeof globalThis & { __tangoMigrationsLoadCount?: number }).__tangoMigrationsLoadCount ?? 0) + 1;

            export const UserModel = Model({
                namespace: 'blog',
                name: 'User',
                table: 'users',
                schema: z.object({
                    id: t.primaryKey(z.number().int()),
                }),
            });

            export const PostModel = Model({
                namespace: 'blog',
                name: 'Post',
                table: 'posts',
                schema: z.object({
                    id: t.primaryKey(z.number().int()),
                    authorId: t.foreignKey('blog/User', {
                        field: z.number().int(),
                        relatedName: 'posts',
                    }),
                }),
            });
            `
        );

        await runMakeMigrations(root);

        expect((globalThis as LoadCounterGlobal)[LOAD_COUNT_KEY]).toBe(1);

        const generatedMigrationName = (await readdir(join(root, 'migrations'))).at(0);
        expect(generatedMigrationName).toBeDefined();

        const generatedMigration = await readFile(join(root, 'migrations', generatedMigrationName as string), 'utf8');
        expect(generatedMigration).toContain("op.table('posts').create");
        expect(generatedMigration).toContain("op.table('users').create");

        const relationTypes = await readFile(join(root, '.tango/relations.generated.d.ts'), 'utf8');
        expect(relationTypes).toContain('"blog/User"');
        expect(relationTypes).toContain('typeof import("../src/models.ts")["UserModel"]');
    });

    it('accepts one-level grouped model exports during make:migrations', async () => {
        const root = await makeTempDir('tango-migrations-cli-grouped-');
        await writeConfigFile(root);
        await writeModelsFile(
            root,
            `
            import { Model, t } from '@danceroutine/tango-schema';
            import { z } from 'zod';

            export const models = {
                UserModel: Model({
                    namespace: 'blog',
                    name: 'User',
                    table: 'users',
                    schema: z.object({
                        id: t.primaryKey(z.number().int()),
                    }),
                }),
                PostModel: Model({
                    namespace: 'blog',
                    name: 'Post',
                    table: 'posts',
                    schema: z.object({
                        id: t.primaryKey(z.number().int()),
                        authorId: t.foreignKey('blog/User', {
                            field: z.number().int(),
                            relatedName: 'posts',
                        }),
                    }),
                }),
            };
            `
        );

        await runMakeMigrations(root);

        const generatedMigrationName = (await readdir(join(root, 'migrations'))).at(0);
        expect(generatedMigrationName).toBeDefined();

        const generatedMigration = await readFile(join(root, 'migrations', generatedMigrationName as string), 'utf8');
        expect(generatedMigration).toContain("op.table('posts').create");
        expect(generatedMigration).toContain("op.table('users').create");

        const relationTypes = await readFile(join(root, '.tango/relations.generated.d.ts'), 'utf8');
        expect(relationTypes).toContain('typeof import("../src/models.ts")["models"]["UserModel"]');
        expect(relationTypes).toContain('typeof import("../src/models.ts")["models"]["PostModel"]');
    });

    it('warns and continues when relation artifact refresh fails', async () => {
        const root = await makeTempDir('tango-migrations-cli-warning-');
        await writeConfigFile(root);
        await writeModelsFile(
            root,
            `
            import { Model, t } from '@danceroutine/tango-schema';
            import { z } from 'zod';

            const UserModel = Model({
                namespace: 'blog',
                name: 'User',
                table: 'users',
                schema: z.object({
                    id: t.primaryKey(z.number().int()),
                }),
            });

            export const PostModel = Model({
                namespace: 'blog',
                name: 'Post',
                table: 'posts',
                schema: z.object({
                    id: t.primaryKey(z.number().int()),
                    authorId: t.foreignKey(UserModel.metadata.key, {
                        field: z.number().int(),
                        relatedName: 'posts',
                    }),
                }),
            });
            `
        );

        await runMakeMigrations(root);

        const generatedMigrationName = (await readdir(join(root, 'migrations'))).at(0);
        expect(generatedMigrationName).toBeDefined();
        expect(warnings).toEqual([
            expect.stringContaining('Unable to refresh generated relation registry during make:migrations'),
        ]);
    });
});
