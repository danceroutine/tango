import { getLogger } from '@danceroutine/tango-core';
import { basename, resolve } from 'path/posix';
import {
    type SupportedFramework,
    type PackageManager,
    FrameworkScaffoldRegistry,
    type FrameworkScaffoldContext,
    scaffoldProject,
} from '../frameworks';
import {
    PACKAGE_MANAGER,
    SCAFFOLD_DATABASE_DIALECT,
    SUPPORTED_FRAMEWORK,
    type ScaffoldDatabaseDialect,
} from '../frameworks/contracts/FrameworkScaffoldStrategy';
import { runInstall } from './runInstall';
import type { Argv } from 'yargs';

type NewCommandArgs = {
    name?: string;
    framework: SupportedFramework;
    path?: string;
    packageManager: PackageManager;
    dialect: ScaffoldDatabaseDialect;
    install: boolean;
    force: boolean;
    seed: boolean;
};
export async function runNewCommand({
    path,
    name,
    framework,
    packageManager,
    dialect,
    install,
    force,
    seed: includeSeed,
}: NewCommandArgs): Promise<void> {
    const registry = FrameworkScaffoldRegistry.createDefault();
    const strategy = registry.get(framework)!;

    const requestedPath = path ?? name ?? 'tango-app';
    const projectName = name ?? basename(requestedPath);
    const targetDir = resolve(process.cwd(), requestedPath);

    const context: FrameworkScaffoldContext = {
        projectName,
        targetDir,
        framework,
        packageManager,
        dialect,
        includeSeed,
    };

    await scaffoldProject(context, strategy, { force });

    if (install) {
        runInstall(packageManager, targetDir);
    }

    const logger = getLogger('tango.codegen');
    logger.info(`Scaffold complete: ${targetDir}`);
    logger.info(`Framework: ${strategy.name}`);
    logger.info(`Run next: cd ${targetDir} && ${packageManager} run dev`);
}
export function withNewCommand(parser: Argv): Argv {
    return parser.command(
        'new [name]',
        'Bootstrap a new Tango project',
        (builder) =>
            builder
                .positional('name', {
                    type: 'string',
                    describe: 'Project name (used as directory when --path is omitted).',
                })
                .option('framework', {
                    type: 'string',
                    choices: Object.values(SUPPORTED_FRAMEWORK),
                    demandOption: true,
                    describe: 'Host framework scaffold to generate.',
                })
                .option('path', {
                    type: 'string',
                    describe: 'Target directory for generated project files.',
                })
                .option('package-manager', {
                    type: 'string',
                    choices: Object.values(PACKAGE_MANAGER),
                    default: PACKAGE_MANAGER.PNPM,
                    describe: 'Package manager used for follow-up instructions and optional install.',
                })
                .option('dialect', {
                    type: 'string',
                    choices: Object.values(SCAFFOLD_DATABASE_DIALECT),
                    default: SCAFFOLD_DATABASE_DIALECT.SQLITE,
                    describe: 'Database dialect default for generated config.',
                })
                .option('install', {
                    type: 'boolean',
                    default: false,
                    describe: 'Install dependencies after scaffolding.',
                })
                .option('force', {
                    type: 'boolean',
                    default: false,
                    describe: 'Allow writing into a non-empty target directory.',
                })
                .option('seed', {
                    type: 'boolean',
                    default: true,
                    describe: 'Include seed/bootstrap sample artifacts when supported by the framework strategy.',
                }),
        async ({ name, framework, path, packageManager, dialect, install, force, seed }) => {
            await runNewCommand({
                name,
                framework,
                path,
                packageManager,
                dialect,
                install,
                force,
                seed,
            });
        }
    );
}
