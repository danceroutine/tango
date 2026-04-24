import { chmod, mkdtemp, mkdir, readFile, readdir, rm, stat, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { tmpdir } from 'node:os';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { describe, expect, it } from 'vitest';
import { scaffoldProject } from '../scaffoldProject';
import { ExpressScaffoldStrategy } from '../../strategies/express/ExpressScaffoldStrategy';
import { NextScaffoldStrategy } from '../../strategies/next/NextScaffoldStrategy';
import { NuxtScaffoldStrategy } from '../../strategies/nuxt/NuxtScaffoldStrategy';

const execFileAsync = promisify(execFile);

describe(scaffoldProject, () => {
    it('writes a full Express project into target directory', async () => {
        const dir = await mkdtemp(join(tmpdir(), 'tango-codegen-express-'));
        try {
            await scaffoldProject(
                {
                    projectName: 'express-app',
                    targetDir: dir,
                    framework: 'express',
                    packageManager: 'pnpm',
                    dialect: 'sqlite',

                    includeSeed: true,
                },
                new ExpressScaffoldStrategy()
            );

            const packageJson = await readFile(join(dir, 'package.json'), 'utf8');
            const appSource = await readFile(join(dir, 'src/index.ts'), 'utf8');
            const tangoSource = await readFile(join(dir, 'src/tango.ts'), 'utf8');
            const openapiSource = await readFile(join(dir, 'src/openapi.ts'), 'utf8');
            const serializerSource = await readFile(join(dir, 'src/serializers/TodoSerializer.ts'), 'utf8');
            const readme = await readFile(join(dir, 'README.md'), 'utf8');
            const scripts = JSON.parse(packageJson).scripts as Record<string, string>;
            expect(packageJson).toContain('"@danceroutine/tango-adapters-express"');
            expect(packageJson).toContain('"@danceroutine/tango-openapi"');
            expect(packageJson).toContain('"setup:schema"');
            expect(scripts['make:migrations']).not.toContain('--name');
            expect(readme).toContain('make:migrations -- --name initial');
            expect(appSource).toContain("from './tango.js'");
            expect(appSource).toContain('await registerTango(app)');
            expect(tangoSource).toContain("adapter.registerViewSet(app, '/api/todos'");
            expect(tangoSource).toContain('/api/openapi.json');
            expect(openapiSource).toContain('describeViewSet');
            expect(serializerSource).toContain('TodoSerializer');
        } finally {
            await rm(dir, { recursive: true, force: true });
        }
    });

    it('writes a full Next project into target directory', async () => {
        const dir = await mkdtemp(join(tmpdir(), 'tango-codegen-next-'));
        try {
            await scaffoldProject(
                {
                    projectName: 'next-app',
                    targetDir: dir,
                    framework: 'next',
                    packageManager: 'pnpm',
                    dialect: 'sqlite',

                    includeSeed: false,
                },
                new NextScaffoldStrategy()
            );

            const packageJson = await readFile(join(dir, 'package.json'), 'utf8');
            const routeSource = await readFile(join(dir, 'src/app/api/health/route.ts'), 'utf8');
            const openapiRoute = await readFile(join(dir, 'src/app/api/openapi/route.ts'), 'utf8');
            const openapiSource = await readFile(join(dir, 'src/lib/openapi.ts'), 'utf8');
            const serializerSource = await readFile(join(dir, 'src/serializers/TodoSerializer.ts'), 'utf8');
            const layoutSource = await readFile(join(dir, 'src/app/layout.tsx'), 'utf8');
            const tsconfig = await readFile(join(dir, 'tsconfig.json'), 'utf8');
            const readme = await readFile(join(dir, 'README.md'), 'utf8');
            const scripts = JSON.parse(packageJson).scripts as Record<string, string>;
            expect(packageJson).toContain('"next"');
            expect(packageJson).toContain('"@danceroutine/tango-openapi"');
            expect(scripts['make:migrations']).not.toContain('--name');
            expect(readme).toContain('make:migrations -- --name initial');
            expect(routeSource).toContain('Response.json');
            expect(openapiRoute).toContain("from '@/lib/openapi'");
            expect(openapiSource).toContain('describeViewSet');
            expect(serializerSource).toContain('TodoSerializer');
            expect(layoutSource).toContain('RootLayout');
            expect(tsconfig).toContain('"migrations/**/*.ts"');
            expect(tsconfig).toContain('".tango/**/*.d.ts"');
        } finally {
            await rm(dir, { recursive: true, force: true });
        }
    });

    it('writes a full Nuxt project into target directory', async () => {
        const dir = await mkdtemp(join(tmpdir(), 'tango-codegen-nuxt-'));
        try {
            await scaffoldProject(
                {
                    projectName: 'nuxt-app',
                    targetDir: dir,
                    framework: 'nuxt',
                    packageManager: 'pnpm',
                    dialect: 'sqlite',
                    includeSeed: true,
                },
                new NuxtScaffoldStrategy()
            );

            const packageJson = await readFile(join(dir, 'package.json'), 'utf8');
            const nuxtConfig = await readFile(join(dir, 'nuxt.config.ts'), 'utf8');
            const routeSource = await readFile(join(dir, 'server/tango/todos.ts'), 'utf8');
            const openapiRoute = await readFile(join(dir, 'server/tango/openapi.ts'), 'utf8');
            const openapiSource = await readFile(join(dir, 'lib/openapi.ts'), 'utf8');
            const serializerSource = await readFile(join(dir, 'serializers/TodoSerializer.ts'), 'utf8');
            const appShell = await readFile(join(dir, 'app/app.vue'), 'utf8');
            const pageSource = await readFile(join(dir, 'app/pages/index.server.vue'), 'utf8');
            const tsconfig = await readFile(join(dir, 'tsconfig.json'), 'utf8');
            const readme = await readFile(join(dir, 'README.md'), 'utf8');
            const scripts = JSON.parse(packageJson).scripts as Record<string, string>;
            expect(packageJson).toContain('"nuxt"');
            expect(packageJson).toContain('"@danceroutine/tango-openapi"');
            expect(scripts['make:migrations']).not.toContain('--name');
            expect(readme).toContain('make:migrations -- --name initial');
            expect(nuxtConfig).toContain('/api/todos/**:tango');
            expect(routeSource).toContain('NuxtAdapter');
            expect(openapiRoute).toContain("from '~~/lib/openapi'");
            expect(openapiSource).toContain('describeViewSet');
            expect(serializerSource).toContain('TodoSerializer');
            expect(appShell).toContain('<NuxtPage />');
            expect(pageSource).toContain('<script setup lang="ts">');
            expect(tsconfig).toContain('"migrations/**/*.ts"');
            expect(tsconfig).toContain('".tango/**/*.d.ts"');
        } finally {
            await rm(dir, { recursive: true, force: true });
        }
    });

    it('forwards named migration args cleanly through the scaffolded package script', async () => {
        const scenarios = [
            {
                framework: 'express' as const,
                strategy: new ExpressScaffoldStrategy(),
                projectName: 'express-script-app',
            },
            {
                framework: 'next' as const,
                strategy: new NextScaffoldStrategy(),
                projectName: 'next-script-app',
            },
            {
                framework: 'nuxt' as const,
                strategy: new NuxtScaffoldStrategy(),
                projectName: 'nuxt-script-app',
            },
        ];

        for (const scenario of scenarios) {
            const dir = await mkdtemp(join(tmpdir(), `tango-codegen-${scenario.framework}-script-`));
            try {
                await scaffoldProject(
                    {
                        projectName: scenario.projectName,
                        targetDir: dir,
                        framework: scenario.framework,
                        packageManager: 'pnpm',
                        dialect: 'sqlite',
                        includeSeed: false,
                    },
                    scenario.strategy
                );

                const tangoBinDir = join(dir, 'node_modules', '.bin');
                await mkdir(tangoBinDir, { recursive: true });
                const tangoStub = join(tangoBinDir, 'tango');
                await writeFile(
                    tangoStub,
                    `#!/usr/bin/env node
const { mkdirSync, writeFileSync } = require('node:fs');
const { join } = require('node:path');
const args = process.argv.slice(2);
const nameIndex = args.indexOf('--name');
if (nameIndex === -1 || !args[nameIndex + 1]) {
  process.stderr.write('missing --name\\n');
  process.exit(1);
}
mkdirSync(join(process.cwd(), 'migrations'), { recursive: true });
writeFileSync(join(process.cwd(), 'migrations', \`20260424120000_\${args[nameIndex + 1]}.ts\`), args.join(' '), 'utf8');
`,
                    'utf8'
                );
                await chmod(tangoStub, 0o755);

                await execFileAsync('pnpm', ['run', 'make:migrations', '--', '--name', 'initial'], { cwd: dir });

                const filenames = await readdir(join(dir, 'migrations'));
                expect(filenames).toContain('20260424120000_initial.ts');
            } finally {
                await rm(dir, { recursive: true, force: true });
            }
        }
    });

    it('creates the target directory when it does not exist', async () => {
        const root = await mkdtemp(join(tmpdir(), 'tango-codegen-relative-'));
        const relativeTarget = join('tmp', `tango-codegen-${Date.now().toString(36)}`);
        const absoluteTarget = join(root, relativeTarget);
        const cwdBefore = process.cwd();
        process.chdir(root);
        try {
            await scaffoldProject(
                {
                    projectName: 'relative-app',
                    targetDir: relativeTarget,
                    framework: 'express',
                    packageManager: 'pnpm',
                    dialect: 'sqlite',

                    includeSeed: true,
                },
                new ExpressScaffoldStrategy()
            );

            const readme = await readFile(join(absoluteTarget, 'README.md'), 'utf8');
            expect(readme).toContain('# relative-app');
        } finally {
            process.chdir(cwdBefore);
            await rm(root, { recursive: true, force: true });
        }
    });

    it('rejects when the target path is an existing file', async () => {
        const root = await mkdtemp(join(tmpdir(), 'tango-codegen-file-target-'));
        const targetFile = join(root, 'target-file');
        try {
            await writeFile(targetFile, 'x', 'utf8');
            await expect(
                scaffoldProject(
                    {
                        projectName: 'file-target',
                        targetDir: targetFile,
                        framework: 'express',
                        packageManager: 'pnpm',
                        dialect: 'sqlite',

                        includeSeed: true,
                    },
                    new ExpressScaffoldStrategy()
                )
            ).rejects.toThrow('exists and is not a directory');
        } finally {
            await rm(root, { recursive: true, force: true });
        }
    });

    it('rejects when the target directory is non-empty unless force is set', async () => {
        const root = await mkdtemp(join(tmpdir(), 'tango-codegen-non-empty-'));
        try {
            await writeFile(join(root, 'existing.txt'), 'existing', 'utf8');

            await expect(
                scaffoldProject(
                    {
                        projectName: 'non-empty',
                        targetDir: root,
                        framework: 'next',
                        packageManager: 'pnpm',
                        dialect: 'sqlite',

                        includeSeed: false,
                    },
                    new NextScaffoldStrategy()
                )
            ).rejects.toThrow('is not empty');

            await scaffoldProject(
                {
                    projectName: 'non-empty',
                    targetDir: root,
                    framework: 'next',
                    packageManager: 'pnpm',
                    dialect: 'sqlite',

                    includeSeed: false,
                },
                new NextScaffoldStrategy(),
                { force: true }
            );
        } finally {
            await rm(root, { recursive: true, force: true });
        }
    });

    it('writes only Tango layer and omits app shell when adding to existing project ', async () => {
        const dir = await mkdtemp(join(tmpdir(), 'tango-codegen-init-'));
        try {
            await scaffoldProject(
                {
                    projectName: 'next-app',
                    targetDir: dir,
                    framework: 'next',
                    packageManager: 'pnpm',
                    dialect: 'sqlite',
                    includeSeed: false,
                },
                new NextScaffoldStrategy(),
                { mode: 'init' }
            );

            const tangoConfig = await readFile(join(dir, 'tango.config.ts'), 'utf8');
            const todoModel = await readFile(join(dir, 'src/lib/models/TodoModel.ts'), 'utf8');
            const serializerSource = await readFile(join(dir, 'src/serializers/TodoSerializer.ts'), 'utf8');
            expect(tangoConfig).toContain("adapter: 'sqlite'");
            expect(todoModel).toContain('TodoModel');
            expect(serializerSource).toContain('TodoSerializer');

            await expect(stat(join(dir, 'package.json'))).rejects.toMatchObject({ code: 'ENOENT' });
            await expect(stat(join(dir, 'src/app/layout.tsx'))).rejects.toMatchObject({ code: 'ENOENT' });
        } finally {
            await rm(dir, { recursive: true, force: true });
        }
    });

    it('writes only Tango layer and omits app shell when adding to an existing Nuxt project', async () => {
        const dir = await mkdtemp(join(tmpdir(), 'tango-codegen-init-nuxt-'));
        try {
            await scaffoldProject(
                {
                    projectName: 'nuxt-app',
                    targetDir: dir,
                    framework: 'nuxt',
                    packageManager: 'pnpm',
                    dialect: 'sqlite',
                    includeSeed: true,
                },
                new NuxtScaffoldStrategy(),
                { mode: 'init' }
            );

            const tangoConfig = await readFile(join(dir, 'tango.config.ts'), 'utf8');
            const todoModel = await readFile(join(dir, 'lib/models/TodoModel.ts'), 'utf8');
            const serializerSource = await readFile(join(dir, 'serializers/TodoSerializer.ts'), 'utf8');
            expect(tangoConfig).toContain("adapter: 'sqlite'");
            expect(todoModel).toContain('TodoModel');
            expect(serializerSource).toContain('TodoSerializer');

            await expect(stat(join(dir, 'package.json'))).rejects.toMatchObject({ code: 'ENOENT' });
            await expect(stat(join(dir, 'nuxt.config.ts'))).rejects.toMatchObject({ code: 'ENOENT' });
            await expect(stat(join(dir, 'app/app.vue'))).rejects.toMatchObject({ code: 'ENOENT' });
        } finally {
            await rm(dir, { recursive: true, force: true });
        }
    });

    it('leaves existing files unchanged when adding to existing project with skip existing ', async () => {
        const dir = await mkdtemp(join(tmpdir(), 'tango-codegen-init-skip-'));
        try {
            const existingTangoConfig = join(dir, 'tango.config.ts');
            await mkdir(dirname(existingTangoConfig), { recursive: true });
            await writeFile(existingTangoConfig, '// existing config', 'utf8');

            await scaffoldProject(
                {
                    projectName: 'p',
                    targetDir: dir,
                    framework: 'express',
                    packageManager: 'pnpm',
                    dialect: 'sqlite',
                    includeSeed: true,
                },
                new ExpressScaffoldStrategy(),
                { mode: 'init', skipExisting: true }
            );

            expect(await readFile(existingTangoConfig, 'utf8')).toBe('// existing config');
            const tangoTs = await readFile(join(dir, 'src/tango.ts'), 'utf8');
            expect(tangoTs).toContain('registerTango');
        } finally {
            await rm(dir, { recursive: true, force: true });
        }
    });

    it('succeeds into non-empty directory when adding to existing project ', async () => {
        const root = await mkdtemp(join(tmpdir(), 'tango-codegen-init-nonempty-'));
        try {
            await writeFile(join(root, 'existing.txt'), 'existing', 'utf8');

            await scaffoldProject(
                {
                    projectName: 'p',
                    targetDir: root,
                    framework: 'express',
                    packageManager: 'pnpm',
                    dialect: 'sqlite',
                    includeSeed: true,
                },
                new ExpressScaffoldStrategy(),
                { mode: 'init' }
            );

            const existing = await readFile(join(root, 'existing.txt'), 'utf8');
            expect(existing).toBe('existing');
            const tangoConfig = await readFile(join(root, 'tango.config.ts'), 'utf8');
            expect(tangoConfig).toContain("adapter: 'sqlite'");
        } finally {
            await rm(root, { recursive: true, force: true });
        }
    });
});
