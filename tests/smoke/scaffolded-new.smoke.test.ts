import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { randomUUID } from 'node:crypto';

const smokeDescribe = process.env.TANGO_RUN_SMOKE === 'true' ? describe.sequential : describe.skip;
const workspaceRoot = process.cwd();

type HostScenario = {
    framework: 'express' | 'next' | 'nuxt';
    projectName: string;
    includeSeed: boolean;
};

function runCommand(
    label: string,
    command: string,
    args: readonly string[],
    cwd: string,
    env?: NodeJS.ProcessEnv
): void {
    const result = spawnSync(command, [...args], {
        cwd,
        env: {
            ...process.env,
            ...env,
        },
        encoding: 'utf8',
    });

    if (result.status === 0) {
        return;
    }

    throw new Error(
        [
            `${label} failed: ${command} ${args.join(' ')}`,
            `cwd=${cwd}`,
            `exit=${String(result.status)}`,
            result.stdout ?? '',
            result.stderr ?? '',
        ].join('\n')
    );
}

function discoverPackageDirs(dir: string): string[] {
    const entries = spawnSync('find', [dir, '-name', 'package.json', '-not', '-path', '*/node_modules/*'], {
        cwd: workspaceRoot,
        encoding: 'utf8',
    });

    if (entries.status !== 0) {
        throw new Error(entries.stderr || 'failed to discover package directories');
    }

    return entries.stdout
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean)
        .map((packageJsonPath) => resolve(workspaceRoot, packageJsonPath.replace(/\/package\.json$/, '')));
}

async function packLocalTangoPackages(): Promise<{ packDir: string; packages: Map<string, string> }> {
    const packDir = resolve(await mkdtemp(join(tmpdir(), 'tango-scaffold-packs-')));
    const packageDirs = discoverPackageDirs('packages');
    const map = new Map<string, string>();

    for (const packageDir of packageDirs) {
        const packageJson = JSON.parse(await readFile(join(packageDir, 'package.json'), 'utf8')) as { name?: string };

        if (!packageJson.name?.startsWith('@danceroutine/tango')) {
            continue;
        }

        const before = new Set(await readdir(packDir));
        runCommand(
            `pack ${packageJson.name}`,
            'pnpm',
            ['--dir', packageDir, 'pack', '--pack-destination', packDir],
            workspaceRoot
        );
        const after = await readdir(packDir);
        const newFile = after.find((entry) => !before.has(entry));
        if (!newFile) {
            throw new Error(`Failed to find packed tarball for ${packageJson.name}`);
        }
        map.set(packageJson.name, join(packDir, newFile));
    }

    return { packDir, packages: map };
}

async function rewriteScaffoldedTangoDeps(projectDir: string, packedPackages: Map<string, string>): Promise<void> {
    const packageJsonPath = join(projectDir, 'package.json');
    const packageJson = JSON.parse(await readFile(packageJsonPath, 'utf8')) as {
        dependencies?: Record<string, string>;
        devDependencies?: Record<string, string>;
        pnpm?: {
            overrides?: Record<string, string>;
        };
    };
    const overrides: Record<string, string> = {};

    for (const section of ['dependencies', 'devDependencies'] as const) {
        const entries = packageJson[section];
        if (!entries) {
            continue;
        }
        for (const [name] of Object.entries(entries)) {
            if (!name.startsWith('@danceroutine/tango')) {
                continue;
            }
            const packedPath = packedPackages.get(name);
            if (!packedPath) {
                throw new Error(`Missing packed tarball for ${name}`);
            }
            const fileSpec = `file:${packedPath}`;
            entries[name] = fileSpec;
            overrides[name] = fileSpec;
        }
    }

    packageJson.pnpm = {
        ...packageJson.pnpm,
        overrides: {
            ...packageJson.pnpm?.overrides,
            ...overrides,
        },
    };

    await writeFile(packageJsonPath, `${JSON.stringify(packageJson, null, 4)}\n`, 'utf8');
}

async function scaffoldFreshProject(
    scenario: HostScenario,
    packedPackages: Map<string, string>
): Promise<{ dir: string; sqliteFile: string }> {
    const dir = await mkdtemp(join(tmpdir(), `tango-new-${scenario.framework}-`));
    const sqliteFile = `/tmp/tango-new-${scenario.framework}-${randomUUID()}.sqlite`;

    runCommand(
        `tango new ${scenario.framework}`,
        'node',
        [
            'packages/cli/bin/tango.js',
            'new',
            scenario.projectName,
            '--framework',
            scenario.framework,
            '--path',
            dir,
            '--package-manager',
            'pnpm',
            '--dialect',
            'sqlite',
            '--seed',
            String(scenario.includeSeed),
        ],
        workspaceRoot
    );

    await rewriteScaffoldedTangoDeps(dir, packedPackages);

    runCommand('scaffold install', 'pnpm', ['install'], dir);
    runCommand('scaffold typecheck', 'pnpm', ['run', 'typecheck'], dir, { TANGO_SQLITE_FILENAME: sqliteFile });
    runCommand('scaffold codegen:relations', 'pnpm', ['run', 'codegen:relations'], dir, {
        TANGO_SQLITE_FILENAME: sqliteFile,
    });
    runCommand('scaffold make:migrations', 'pnpm', ['run', 'make:migrations', '--name', 'initial'], dir, {
        TANGO_SQLITE_FILENAME: sqliteFile,
    });
    runCommand('scaffold setup:schema', 'pnpm', ['run', 'setup:schema'], dir, { TANGO_SQLITE_FILENAME: sqliteFile });
    if (scenario.includeSeed) {
        runCommand('scaffold bootstrap', 'pnpm', ['run', 'bootstrap'], dir, { TANGO_SQLITE_FILENAME: sqliteFile });
    }

    return { dir, sqliteFile };
}

smokeDescribe('fresh tango new scaffold smoke tests', () => {
    const scenarios: HostScenario[] = [
        { framework: 'express', projectName: 'express-scaffold-smoke', includeSeed: true },
        { framework: 'next', projectName: 'next-scaffold-smoke', includeSeed: false },
        { framework: 'nuxt', projectName: 'nuxt-scaffold-smoke', includeSeed: false },
    ];

    const createdDirs: string[] = [];
    const sqliteFiles: string[] = [];
    let packedPackages = new Map<string, string>();
    let packDir: string | null = null;

    beforeAll(async () => {
        const packed = await packLocalTangoPackages();
        packDir = packed.packDir;
        packedPackages = packed.packages;
    }, 180_000);

    afterAll(async () => {
        for (const dir of createdDirs) {
            await rm(dir, { recursive: true, force: true });
        }
        for (const sqliteFile of sqliteFiles) {
            await rm(sqliteFile, { force: true });
        }
        if (packDir) {
            await rm(packDir, { recursive: true, force: true });
        }
    });

    for (const scenario of scenarios) {
        it(`boots a fresh ${scenario.framework} scaffold through tango new`, async () => {
            const result = await scaffoldFreshProject(scenario, packedPackages);
            createdDirs.push(result.dir);
            sqliteFiles.push(result.sqliteFile);

            const packageJson = JSON.parse(await readFile(join(result.dir, 'package.json'), 'utf8')) as {
                scripts: Record<string, string>;
            };

            expect(packageJson.scripts['make:migrations']).not.toContain('npm_config_name');
            expect(packageJson.scripts['make:migrations']).not.toContain('--name');

            if (scenario.framework === 'express') {
                await expectPathMissing(join(result.dir, 'src/app/layout.tsx'));
                await expectPathMissing(join(result.dir, 'nuxt.config.ts'));
                return;
            }

            if (scenario.framework === 'next') {
                await expectPathMissing(join(result.dir, 'src/tango.ts'));
                await expectPathMissing(join(result.dir, 'nuxt.config.ts'));
                return;
            }

            runCommand('scaffold build', 'pnpm', ['run', 'build'], result.dir, {
                TANGO_SQLITE_FILENAME: result.sqliteFile,
            });
            await expect(readFile(join(result.dir, 'app/pages/index.server.vue'), 'utf8')).resolves.toContain(
                'Tango + Nuxt'
            );
        }, 240_000);
    }
});

async function expectPathMissing(path: string): Promise<void> {
    await expect(readFile(path, 'utf8')).rejects.toThrow();
}
