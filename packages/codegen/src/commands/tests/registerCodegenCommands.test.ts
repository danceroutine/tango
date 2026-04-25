import { mkdir, mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import yargs from 'yargs';
import { describe, expect, it, vi } from 'vitest';
import { withGlobalTestApi } from '@danceroutine/tango-testing';
import { Model, t } from '@danceroutine/tango-schema';
import { registerCodegenCommands } from '../registerCodegenCommands';
import { spawnSync } from 'node:child_process';

vi.mock('node:child_process', () => ({
    spawnSync: vi.fn(),
}));

describe(registerCodegenCommands, () => {
    it('writes a new Express project when new is run with framework and path', async () => {
        const dir = await mkdtemp(join(tmpdir(), 'tango-codegen-cmd-'));
        const targetDir = join(dir, 'demo');
        try {
            const parser = registerCodegenCommands(
                yargs(['new', 'demo', '--framework', 'express', '--path', targetDir])
            );
            await parser.parseAsync();

            const packageJson = await readFile(join(targetDir, 'package.json'), 'utf8');
            const tsconfig = await readFile(join(targetDir, 'tsconfig.json'), 'utf8');
            const source = await readFile(join(targetDir, 'src/index.ts'), 'utf8');
            await expect(stat(join(targetDir, 'src/app/layout.tsx'))).rejects.toThrow();
            await expect(stat(join(targetDir, 'nuxt.config.ts'))).rejects.toThrow();
            expect(packageJson).toContain('"name": "demo"');
            expect(packageJson).toContain('"@danceroutine/tango-migrations"');
            expect(packageJson).toContain('"@danceroutine/tango-openapi"');
            expect((JSON.parse(tsconfig) as { include: string[] }).include).not.toContain('migrations');
            expect(source).toContain("from './tango.js'");
            expect(source).toContain('await registerTango(app)');
        } finally {
            await rm(dir, { recursive: true, force: true });
        }
    });

    it('writes a new project when codegen new is used', async () => {
        const dir = await mkdtemp(join(tmpdir(), 'tango-codegen-alias-'));
        const targetDir = join(dir, 'demo-alias');
        try {
            const parser = registerCodegenCommands(
                yargs(['codegen', 'new', 'demo-alias', '--framework', 'next', '--path', targetDir])
            );
            await parser.parseAsync();

            const readme = await readFile(join(targetDir, 'README.md'), 'utf8');
            await expect(stat(join(targetDir, 'src/tango.ts'))).rejects.toThrow();
            await expect(stat(join(targetDir, 'nuxt.config.ts'))).rejects.toThrow();
            expect(readme).toContain('scaffolded by `tango new --framework next`');
        } finally {
            await rm(dir, { recursive: true, force: true });
        }
    });

    it('writes relation registry artifacts when codegen relations is used', async () => {
        const dir = await mkdtemp(join(process.cwd(), '.tmp-tango-codegen-relations-cli-'));
        try {
            await mkdir(join(dir, 'src'), { recursive: true });
            await writeFile(
                join(dir, 'src/models.ts'),
                `
                import { z } from 'zod';
                const { Model, t } = globalThis.__tangoCodegenRelationsCliTestApi;

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
                `,
                'utf8'
            );

            const cwdBefore = process.cwd();
            process.chdir(dir);
            try {
                await withGlobalTestApi('__tangoCodegenRelationsCliTestApi', { Model, t }, async () => {
                    const parser = registerCodegenCommands(
                        yargs(['codegen', 'relations', '--models', './src/models.ts'])
                    );
                    await parser.parseAsync();
                });
            } finally {
                process.chdir(cwdBefore);
            }

            const declaration = await readFile(join(dir, '.tango/relations.generated.d.ts'), 'utf8');
            expect(declaration).toContain('"blog/User"');
        } finally {
            await rm(dir, { recursive: true, force: true });
        }
    });

    it('writes a new Nuxt project when new is run with framework and path', async () => {
        const dir = await mkdtemp(join(tmpdir(), 'tango-codegen-nuxt-cmd-'));
        const targetDir = join(dir, 'demo-nuxt');
        try {
            const parser = registerCodegenCommands(
                yargs(['new', 'demo-nuxt', '--framework', 'nuxt', '--path', targetDir])
            );
            await parser.parseAsync();

            const packageJson = await readFile(join(targetDir, 'package.json'), 'utf8');
            const nuxtConfig = await readFile(join(targetDir, 'nuxt.config.ts'), 'utf8');
            const routeSource = await readFile(join(targetDir, 'server/tango/todos.ts'), 'utf8');
            const readme = await readFile(join(targetDir, 'README.md'), 'utf8');
            await expect(stat(join(targetDir, 'src/index.ts'))).rejects.toThrow();
            await expect(stat(join(targetDir, 'src/app/layout.tsx'))).rejects.toThrow();
            expect(packageJson).toContain('"nuxt"');
            expect(packageJson).toContain('"@danceroutine/tango-adapters-nuxt"');
            expect(nuxtConfig).toContain('/api/todos/**:tango');
            expect(routeSource).toContain('NuxtAdapter');
            expect(readme).toContain('Nuxt owns the public page route at `/`');
        } finally {
            await rm(dir, { recursive: true, force: true });
        }
    });

    it('runs package manager install when install flag is set', async () => {
        const dir = await mkdtemp(join(tmpdir(), 'tango-codegen-install-'));
        const targetDir = join(dir, 'demo-install');
        vi.mocked(spawnSync).mockReturnValue({
            status: 0,
            output: [],
            stdout: '',
            stderr: '',
            pid: 0,
            signal: null,
        });
        try {
            const parser = registerCodegenCommands(
                yargs([
                    'new',
                    'demo-install',
                    '--framework',
                    'express',
                    '--path',
                    targetDir,
                    '--install',
                    '--package-manager',
                    'pnpm',
                ])
            );
            await parser.parseAsync();

            expect(spawnSync).toHaveBeenCalledWith(
                'pnpm',
                ['install'],
                expect.objectContaining({ cwd: targetDir, stdio: 'inherit', env: process.env })
            );
        } finally {
            vi.mocked(spawnSync).mockReset();
            await rm(dir, { recursive: true, force: true });
        }
    });

    it('rejects when install fails', async () => {
        const dir = await mkdtemp(join(tmpdir(), 'tango-codegen-install-fail-'));
        const targetDir = join(dir, 'demo-install-fail');
        vi.mocked(spawnSync).mockReturnValue({
            status: 2,
            output: [],
            stdout: '',
            stderr: '',
            pid: 0,
            signal: null,
        });
        try {
            const parser = registerCodegenCommands(
                yargs([
                    'new',
                    'demo-install-fail',
                    '--framework',
                    'next',
                    '--path',
                    targetDir,
                    '--install',
                    '--package-manager',
                    'pnpm',
                ])
            );

            await expect(parser.parseAsync()).rejects.toThrow('Dependency install failed with pnpm');
        } finally {
            vi.mocked(spawnSync).mockReset();
            await rm(dir, { recursive: true, force: true });
        }
    });

    it('uses default project name when neither name nor path is provided', async () => {
        const dir = await mkdtemp(join(tmpdir(), 'tango-codegen-default-dir-'));
        const cwdBefore = process.cwd();
        process.chdir(dir);
        try {
            const parser = registerCodegenCommands(yargs(['new', '--framework', 'express']));
            await parser.parseAsync();

            const readme = await readFile(join(dir, 'tango-app/README.md'), 'utf8');
            expect(readme).toContain('# tango-app');
        } finally {
            process.chdir(cwdBefore);
            await rm(dir, { recursive: true, force: true });
        }
    });

    it('derives project name from path when path is provided without name', async () => {
        const dir = await mkdtemp(join(tmpdir(), 'tango-codegen-path-name-'));
        const targetDir = join(dir, 'apps', 'derived-name');
        try {
            const parser = registerCodegenCommands(yargs(['new', '--framework', 'next', '--path', targetDir]));
            await parser.parseAsync();

            const packageJson = await readFile(join(targetDir, 'package.json'), 'utf8');
            expect(packageJson).toContain('"name": "derived-name"');
        } finally {
            await rm(dir, { recursive: true, force: true });
        }
    });

    it('rejects with unknown exit when install returns no exit code', async () => {
        const dir = await mkdtemp(join(tmpdir(), 'tango-codegen-install-unknown-'));
        const targetDir = join(dir, 'demo-install-unknown');
        vi.mocked(spawnSync).mockReturnValue({
            status: null,
            output: [],
            stdout: '',
            stderr: '',
            pid: 0,
            signal: null,
        });
        try {
            const parser = registerCodegenCommands(
                yargs(['new', '--framework', 'express', '--path', targetDir, '--install', '--package-manager', 'pnpm'])
            );

            await expect(parser.parseAsync()).rejects.toThrow('Exit code: unknown');
        } finally {
            vi.mocked(spawnSync).mockReset();
            await rm(dir, { recursive: true, force: true });
        }
    });

    it('writes only Tango layer and omits app shell for Next when init is run', async () => {
        const dir = await mkdtemp(join(tmpdir(), 'tango-codegen-init-cmd-'));
        try {
            const parser = registerCodegenCommands(yargs(['init', '--framework', 'next', '--path', dir]));
            await parser.parseAsync();

            const tangoConfig = await readFile(join(dir, 'tango.config.ts'), 'utf8');
            const todoModel = await readFile(join(dir, 'src/lib/models/TodoModel.ts'), 'utf8');
            expect(tangoConfig).toContain("adapter: 'sqlite'");
            expect(todoModel).toContain('TodoModel');

            await expect(stat(join(dir, 'package.json'))).rejects.toMatchObject({ code: 'ENOENT' });
            await expect(stat(join(dir, 'src/app/layout.tsx'))).rejects.toMatchObject({ code: 'ENOENT' });
        } finally {
            await rm(dir, { recursive: true, force: true });
        }
    });

    it('writes register file and omits app shell when codegen init is used for Express', async () => {
        const dir = await mkdtemp(join(tmpdir(), 'tango-codegen-init-alias-'));
        try {
            const parser = registerCodegenCommands(yargs(['codegen', 'init', '--framework', 'express', '--path', dir]));
            await parser.parseAsync();

            const tangoTs = await readFile(join(dir, 'src/tango.ts'), 'utf8');
            expect(tangoTs).toContain('registerTango');
            await expect(stat(join(dir, 'package.json'))).rejects.toMatchObject({ code: 'ENOENT' });
        } finally {
            await rm(dir, { recursive: true, force: true });
        }
    });

    it('writes only Tango layer and omits app shell for Nuxt when init is run', async () => {
        const dir = await mkdtemp(join(tmpdir(), 'tango-codegen-init-nuxt-cmd-'));
        try {
            const parser = registerCodegenCommands(yargs(['init', '--framework', 'nuxt', '--path', dir]));
            await parser.parseAsync();

            const tangoConfig = await readFile(join(dir, 'tango.config.ts'), 'utf8');
            const todoModel = await readFile(join(dir, 'lib/models/TodoModel.ts'), 'utf8');
            expect(tangoConfig).toContain("adapter: 'sqlite'");
            expect(todoModel).toContain('TodoModel');

            await expect(stat(join(dir, 'package.json'))).rejects.toMatchObject({ code: 'ENOENT' });
            await expect(stat(join(dir, 'nuxt.config.ts'))).rejects.toMatchObject({ code: 'ENOENT' });
            await expect(stat(join(dir, 'app/app.vue'))).rejects.toMatchObject({ code: 'ENOENT' });
        } finally {
            await rm(dir, { recursive: true, force: true });
        }
    });
});
