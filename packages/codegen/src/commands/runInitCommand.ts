import { getLogger } from '@danceroutine/tango-core';
import { readdir, readFile } from 'fs/promises';
import { resolve, basename, join } from 'path/posix';
import {
    type PackageManager,
    type SupportedFramework,
    FrameworkScaffoldRegistry,
    type FrameworkScaffoldContext,
    scaffoldProject,
} from '../frameworks';
import {
    PACKAGE_MANAGER,
    SCAFFOLD_DATABASE_DIALECT,
    type ScaffoldDatabaseDialect,
    SUPPORTED_FRAMEWORK,
} from '../frameworks/contracts/FrameworkScaffoldStrategy';
import type { Argv } from 'yargs';

async function detectPackageManager(targetDir: string): Promise<PackageManager> {
    try {
        const entries = await readdir(targetDir);
        if (entries.includes('pnpm-lock.yaml')) return PACKAGE_MANAGER.PNPM;
        if (entries.includes('package-lock.json')) return PACKAGE_MANAGER.NPM;
        if (entries.includes('yarn.lock')) return PACKAGE_MANAGER.YARN;
        if (entries.includes('bun.lockb') || entries.includes('bun.lock')) return PACKAGE_MANAGER.BUN;
    } catch {
        // ENOENT or other: fall through to default
    }
    return PACKAGE_MANAGER.PNPM;
}
type InitCommandArgs = {
    framework: SupportedFramework;
    path: string;
    dialect: ScaffoldDatabaseDialect;
    skipExisting: boolean;
    force: boolean;
};
export async function runInitCommand({
    framework,
    path,
    dialect,
    skipExisting,
    force,
}: InitCommandArgs): Promise<void> {
    const registry = FrameworkScaffoldRegistry.createDefault();
    const strategy = registry.get(framework)!;
    const targetDir = resolve(process.cwd(), path);

    let projectName = basename(targetDir);
    try {
        const pkgPath = join(targetDir, 'package.json');
        const raw = await readFile(pkgPath, 'utf8');
        const pkg = JSON.parse(raw) as { name?: string };
        if (typeof pkg.name === 'string' && pkg.name.length > 0) {
            projectName = pkg.name;
        }
    } catch {
        // no package.json or invalid: keep basename
    }

    const packageManager = await detectPackageManager(targetDir);

    const context: FrameworkScaffoldContext = {
        projectName,
        targetDir,
        framework,
        packageManager,
        dialect,
        includeSeed: true,
    };

    await scaffoldProject(context, strategy, {
        mode: 'init',
        skipExisting,
        force,
    });

    const logger = getLogger('tango.codegen');
    logger.info(`Tango init complete: ${targetDir}`);
    logger.info(`Install dependencies: ${strategy.getTangoInstallOneLiner(packageManager, context)}`);
    if (framework === SUPPORTED_FRAMEWORK.EXPRESS) {
        logger.info("Mount Tango: import { registerTango } from './src/tango.js'; await registerTango(app);");
    }
}
export function withInitCommand(parser: Argv): Argv {
    return parser.command(
        'init',
        'Add Tango to an existing project (only Tango-layer files)',
        (builder) =>
            builder
                .option('framework', {
                    type: 'string',
                    choices: Object.values(SUPPORTED_FRAMEWORK),
                    demandOption: true,
                    describe: 'Host framework (express or next).',
                })
                .option('path', {
                    type: 'string',
                    default: '.',
                    describe: 'Target directory (default: current directory).',
                })
                .option('dialect', {
                    type: 'string',
                    choices: Object.values(SCAFFOLD_DATABASE_DIALECT),
                    default: SCAFFOLD_DATABASE_DIALECT.SQLITE,
                    describe: 'Database dialect for generated config.',
                })
                .option('skip-existing', {
                    type: 'boolean',
                    default: true,
                    describe: 'Do not overwrite existing files.',
                })
                .option('force', {
                    type: 'boolean',
                    default: false,
                    describe: 'Overwrite existing files when set.',
                }),
        async ({ framework, path, dialect, skipExisting, force }) => {
            await runInitCommand({
                framework,
                path,
                dialect,
                skipExisting,
                force,
            });
        }
    );
}
