import { access, mkdir } from 'node:fs/promises';
import { constants as fsConstants } from 'node:fs';
import { dirname, resolve } from 'node:path';
import type { Argv } from 'yargs';
import { MigrationRunner } from '../runner/MigrationRunner';
import { MigrationGenerator } from '../generator/MigrationGenerator';
import { diffSchema } from '../diff/diffSchema';
import type { DbSchema } from '../introspect/PostgresIntrospector';
import type { Dialect } from '../domain/Dialect';
import type { ColumnType } from '../builder/contracts/ColumnType';
import type { DeleteReferentialAction } from '../builder/contracts/DeleteReferentialAction';
import type { UpdateReferentialAction } from '../builder/contracts/UpdateReferentialAction';
import { createDefaultIntrospectorStrategy } from '../strategies/IntrospectorStrategy';
import { InternalDialect } from '../domain/internal/InternalDialect';
import { loadConfig } from '@danceroutine/tango-config';
import { loadProjectModule } from '@danceroutine/tango-codegen/commands';
import { writeRelationRegistryArtifacts } from '@danceroutine/tango-codegen/generators';
import { getLogger } from '@danceroutine/tango-core';
import { GENERATED_RELATION_REGISTRY_DIRNAME, ModelRegistry } from '@danceroutine/tango-schema';
import { loadModule } from '../runtime/loadModule';

const logger = getLogger('tango.migrations');

type ConfigEnvironment = 'development' | 'test' | 'production';

type OptionalMigrationDefaults = {
    dialect?: Dialect;
    db?: string;
    dir?: string;
    autoApply?: boolean;
};

type ModelMetadataLike = {
    table: string;
    fields: Array<{
        name: string;
        type: ColumnType;
        notNull?: boolean;
        default?: string | { now: true } | null;
        primaryKey?: boolean;
        unique?: boolean;
        references?: {
            table: string;
            column: string;
            onDelete?: DeleteReferentialAction;
            onUpdate?: UpdateReferentialAction;
        };
    }>;
    indexes?: Array<{ name: string; on: string[]; unique?: boolean }>;
};

type CliDbClient = {
    query<T = unknown>(sql: string, params?: readonly unknown[]): Promise<{ rows: T[] }>;
    close(): Promise<void>;
};

type LoadedModelsResult = {
    models: ModelMetadataLike[];
    registry: ModelRegistry;
    modelTypeAccessors: Record<string, string>;
};

type ModelContainerLike = {
    metadata: ModelMetadataLike;
};

async function importModule(modulePath: string): Promise<Record<string, unknown>> {
    return loadModule(modulePath, { projectRoot: process.cwd() });
}

async function tryLoadMigrationDefaults(
    configPathArg: string | undefined,
    configEnvArg: ConfigEnvironment | undefined
): Promise<OptionalMigrationDefaults> {
    const explicitConfigPath = typeof configPathArg === 'string' && configPathArg.trim().length > 0;
    const resolvedPath = resolve(process.cwd(), configPathArg?.trim() || './tango.config.ts');

    try {
        await access(resolvedPath, fsConstants.F_OK);
    } catch (error) {
        if (explicitConfigPath) {
            throw new Error(`Config file not found: ${resolvedPath}`, { cause: error });
        }
        return {};
    }

    const module = await importModule(resolvedPath);
    const fileConfig = (module.default ?? module) as { current?: ConfigEnvironment } & Record<string, unknown>;

    const loaded = loadConfig(() => ({
        ...fileConfig,
        ...(configEnvArg ? { current: configEnvArg } : {}),
    }));

    const { db, migrations } = loaded.current;
    const inferredDialect = db.adapter as Dialect;
    const inferredDb = resolveDbTarget(db);

    return {
        dialect: inferredDialect,
        db: inferredDb,
        dir: migrations.dir,
        autoApply: (migrations as { autoApply?: boolean }).autoApply,
    };
}

function resolveDbTarget(db: {
    adapter: string;
    url?: string;
    filename?: string;
    host?: string;
    port?: number;
    database?: string;
    user?: string;
    password?: string;
}): string | undefined {
    if (db.adapter === InternalDialect.SQLITE) {
        return db.filename ?? db.url;
    }

    if (db.url) {
        return db.url;
    }

    if (!db.database) {
        return undefined;
    }

    const host = db.host ?? 'localhost';
    const port = db.port ?? 5432;
    const encodedUser = db.user ? encodeURIComponent(db.user) : '';
    const encodedPassword = db.password ? encodeURIComponent(db.password) : '';
    const userInfo =
        encodedUser.length > 0
            ? encodedPassword.length > 0
                ? `${encodedUser}:${encodedPassword}@`
                : `${encodedUser}@`
            : '';

    return `postgres://${userInfo}${host}:${String(port)}/${db.database}`;
}

async function resolveCommandInputs(argv: {
    dialect?: string;
    dir?: string;
    db?: string;
    config?: string;
    env?: ConfigEnvironment;
}): Promise<{ dialect: Dialect; dir: string; db?: string; autoApply: boolean }> {
    const defaults = await tryLoadMigrationDefaults(argv.config, argv.env);

    const resolvedDialect = (argv.dialect as Dialect | undefined) ?? defaults.dialect ?? InternalDialect.POSTGRES;
    const resolvedDir = argv.dir ?? defaults.dir ?? 'migrations';
    const resolvedDb = argv.db ?? defaults.db;

    return {
        dialect: resolvedDialect,
        dir: resolvedDir,
        db: resolvedDb,
        autoApply: defaults.autoApply ?? true,
    };
}

function isModelContainerLike(value: unknown): value is ModelContainerLike {
    return typeof value === 'object' && value !== null && 'metadata' in value;
}

function collectExportedModels(moduleValue: unknown): ModelMetadataLike[] {
    if (!moduleValue || typeof moduleValue !== 'object') {
        return [];
    }

    const models: ModelMetadataLike[] = [];
    for (const value of Object.values(moduleValue as Record<string, unknown>)) {
        if (isModelContainerLike(value)) {
            models.push(value.metadata);
            continue;
        }

        if (!value || typeof value !== 'object') {
            continue;
        }

        for (const nestedValue of Object.values(value as Record<string, unknown>)) {
            if (isModelContainerLike(nestedValue)) {
                models.push(nestedValue.metadata);
            }
        }
    }

    return models;
}

async function loadModels(modelsPath: string): Promise<LoadedModelsResult> {
    const {
        loaded: mod,
        registry,
        modelTypeAccessors,
    } = await loadProjectModule(modelsPath, {
        projectRoot: process.cwd(),
        outputDir: resolve(process.cwd(), GENERATED_RELATION_REGISTRY_DIRNAME),
    });
    const moduleValue = (mod.default ?? mod) as unknown;

    const models = isModelContainerLike(moduleValue)
        ? [moduleValue.metadata, ...collectExportedModels(moduleValue)]
        : collectExportedModels(moduleValue);

    if (models.length === 0) {
        throw new Error(`No models found in '${modelsPath}'. Ensure the module exports Model() definitions.`);
    }

    return {
        models,
        registry,
        modelTypeAccessors,
    };
}

async function connectAndIntrospect(dbUrl: string, dialect: string): Promise<DbSchema> {
    const dbClient = await connectDbClient(dbUrl, dialect as Dialect);

    try {
        const strategy = createDefaultIntrospectorStrategy();
        return await strategy.introspect(dialect as Dialect, dbClient);
    } finally {
        await dbClient.close();
    }
}

async function connectDbClient(db: string, dialect: Dialect): Promise<CliDbClient> {
    if (dialect === InternalDialect.POSTGRES) {
        const pg = await import('pg');
        const client = new pg.default.Client({ connectionString: db });
        await client.connect();

        return {
            async query<T = unknown>(sql: string, params?: readonly unknown[]): Promise<{ rows: T[] }> {
                const result = await client.query(sql, params as unknown[] | undefined);
                return { rows: result.rows as T[] };
            },
            async close(): Promise<void> {
                await client.end();
            },
        };
    }

    if (dialect === InternalDialect.SQLITE) {
        const sqlite = await import('better-sqlite3');
        const DatabaseCtor = (sqlite.default ?? sqlite) as new (filename: string) => {
            prepare(sql: string): {
                all(...params: unknown[]): unknown[];
                run(...params: unknown[]): unknown;
            };
            close(): void;
        };

        const filename = normalizeSqliteFilename(db);
        await ensureSqliteParentDirectory(filename);
        const connection = new DatabaseCtor(filename);

        return {
            async query<T = unknown>(sql: string, params?: readonly unknown[]): Promise<{ rows: T[] }> {
                const statement = connection.prepare(sql);
                const values = [...(params ?? [])];
                const isSelectLike = /^\s*(SELECT|PRAGMA|WITH)\b/i.test(sql);
                if (isSelectLike) {
                    return { rows: statement.all(...values) as T[] };
                }

                statement.run(...values);
                return { rows: [] as T[] };
            },
            async close(): Promise<void> {
                connection.close();
            },
        };
    }

    throw new Error(`Unsupported dialect: ${dialect}`);
}

async function ensureSqliteParentDirectory(filename: string): Promise<void> {
    if (filename === ':memory:' || filename === 'file::memory:') {
        return;
    }
    const directory = dirname(filename);
    if (directory === '.' || directory.length === 0) {
        return;
    }
    await mkdir(directory, { recursive: true });
}

function normalizeSqliteFilename(db: string): string {
    if (db.startsWith('sqlite://')) {
        return db.slice('sqlite://'.length);
    }
    return db;
}

/**
 * Register Tango's migration commands on an existing yargs parser.
 */
export function registerMigrationsCommands(yargsBuilder: Argv): Argv {
    return yargsBuilder
        .command(
            'migrate',
            'Apply pending migrations to the database',
            (builder) =>
                builder
                    .option('dir', {
                        type: 'string',
                        describe: 'Migrations directory',
                    })
                    .option('db', {
                        type: 'string',
                        describe: 'Database connection URL',
                    })
                    .option('dialect', {
                        type: 'string',
                        choices: ['postgres', 'sqlite'] as const,
                        describe: 'Database dialect',
                    })
                    .option('config', {
                        type: 'string',
                        describe: 'Path to tango.config.ts (auto-loads ./tango.config.ts when present)',
                    })
                    .option('env', {
                        type: 'string',
                        choices: ['development', 'test', 'production'] as const,
                        describe: 'Config environment override',
                    })
                    .option('to', {
                        type: 'string',
                        describe: 'Target migration ID (apply up to this migration)',
                    }),
            async (argv) => {
                const resolved = await resolveCommandInputs({
                    dialect: argv.dialect as string | undefined,
                    dir: argv.dir as string | undefined,
                    db: argv.db as string | undefined,
                    config: argv.config as string | undefined,
                    env: argv.env as ConfigEnvironment | undefined,
                });

                if (!resolved.autoApply) {
                    logger.info('Auto-migration disabled (autoApply: false). Skipping.');
                    return;
                }

                if (!resolved.db) {
                    throw new Error('No database target provided. Pass --db or define db settings in tango.config.ts.');
                }

                const dbClient = await connectDbClient(resolved.db, resolved.dialect);

                const runner = new MigrationRunner(dbClient, resolved.dialect, resolved.dir);
                await runner.apply(argv.to);

                await dbClient.close();
                logger.info('Migrations applied successfully');
            }
        )
        .command(
            'make:migrations',
            'Generate migration file by comparing models to database',
            (builder) =>
                builder
                    .option('dir', {
                        type: 'string',
                        describe: 'Migrations directory',
                    })
                    .option('name', {
                        type: 'string',
                        demandOption: true,
                        describe: 'Migration name (e.g. "create_users")',
                    })
                    .option('models', {
                        type: 'string',
                        demandOption: true,
                        describe: 'Path to module exporting Model definitions (e.g. "./src/models.ts")',
                    })
                    .option('db', {
                        type: 'string',
                        describe: 'Database connection URL for introspection (omit for initial migration)',
                    })
                    .option('dialect', {
                        type: 'string',
                        choices: ['postgres', 'sqlite'] as const,
                        describe: 'Database dialect',
                    })
                    .option('config', {
                        type: 'string',
                        describe: 'Path to tango.config.ts (auto-loads ./tango.config.ts when present)',
                    })
                    .option('env', {
                        type: 'string',
                        choices: ['development', 'test', 'production'] as const,
                        describe: 'Config environment override',
                    }),
            async (argv) => {
                const resolved = await resolveCommandInputs({
                    dialect: argv.dialect as string | undefined,
                    dir: argv.dir as string | undefined,
                    db: argv.db as string | undefined,
                    config: argv.config as string | undefined,
                    env: argv.env as ConfigEnvironment | undefined,
                });
                const loaded = await loadModels(argv.models);
                logger.info(`Found ${loaded.models.length} model(s): ${loaded.models.map((m) => m.table).join(', ')}`);
                try {
                    await writeRelationRegistryArtifacts({
                        registry: loaded.registry,
                        modelTypeAccessors: loaded.modelTypeAccessors,
                        outputDir: resolve(process.cwd(), GENERATED_RELATION_REGISTRY_DIRNAME),
                    });
                } catch (error) {
                    logger.warn(
                        `Unable to refresh generated relation registry during make:migrations. Continuing without updated relation artifacts: ${error instanceof Error ? error.message : String(error)}`
                    );
                }

                let dbState: DbSchema;
                if (resolved.db) {
                    logger.info('Introspecting database...');
                    dbState = await connectAndIntrospect(resolved.db, resolved.dialect);
                } else {
                    dbState = { tables: {} };
                }

                const operations = diffSchema(dbState, loaded.models);

                if (operations.length === 0) {
                    logger.info('No changes detected — models and database are in sync');
                    return;
                }

                const generator = new MigrationGenerator();
                const filepath = await generator.generate({
                    name: argv.name,
                    operations,
                    directory: resolved.dir,
                });

                logger.info(`Generated migration: ${filepath}`);
                logger.info(`  ${operations.length} operation(s)`);
            }
        )
        .command(
            'plan',
            'Print migration SQL without applying',
            (builder) =>
                builder
                    .option('dir', {
                        type: 'string',
                        describe: 'Migrations directory',
                    })
                    .option('dialect', {
                        type: 'string',
                        choices: ['postgres', 'sqlite'] as const,
                        describe: 'Database dialect',
                    })
                    .option('config', {
                        type: 'string',
                        describe: 'Path to tango.config.ts (auto-loads ./tango.config.ts when present)',
                    })
                    .option('env', {
                        type: 'string',
                        choices: ['development', 'test', 'production'] as const,
                        describe: 'Config environment override',
                    }),
            async (argv) => {
                const resolved = await resolveCommandInputs({
                    dialect: argv.dialect as string | undefined,
                    dir: argv.dir as string | undefined,
                    db: argv.db as string | undefined,
                    config: argv.config as string | undefined,
                    env: argv.env as ConfigEnvironment | undefined,
                });
                const runner = new MigrationRunner(
                    { query: async () => ({ rows: [] }), close: async () => {} },
                    resolved.dialect,
                    resolved.dir
                );
                const output = await runner.plan();
                logger.info(output);
            }
        )
        .command(
            'status',
            'Show applied/pending status of all migrations',
            (builder) =>
                builder
                    .option('dir', {
                        type: 'string',
                        describe: 'Migrations directory',
                    })
                    .option('db', {
                        type: 'string',
                        describe: 'Database connection URL',
                    })
                    .option('dialect', {
                        type: 'string',
                        choices: ['postgres', 'sqlite'] as const,
                        describe: 'Database dialect',
                    })
                    .option('config', {
                        type: 'string',
                        describe: 'Path to tango.config.ts (auto-loads ./tango.config.ts when present)',
                    })
                    .option('env', {
                        type: 'string',
                        choices: ['development', 'test', 'production'] as const,
                        describe: 'Config environment override',
                    }),
            async (argv) => {
                const resolved = await resolveCommandInputs({
                    dialect: argv.dialect as string | undefined,
                    dir: argv.dir as string | undefined,
                    db: argv.db as string | undefined,
                    config: argv.config as string | undefined,
                    env: argv.env as ConfigEnvironment | undefined,
                });
                if (!resolved.db) {
                    throw new Error('No database target provided. Pass --db or define db settings in tango.config.ts.');
                }

                const dbClient = await connectDbClient(resolved.db, resolved.dialect);

                const runner = new MigrationRunner(dbClient, resolved.dialect, resolved.dir);
                const statuses = await runner.status();

                if (statuses.length === 0) {
                    logger.info('No migrations found');
                } else {
                    statuses.forEach((statusItem) => {
                        const marker = statusItem.applied ? '[x]' : '[ ]';
                        logger.info(`  ${marker} ${statusItem.id}`);
                    });
                }

                await dbClient.close();
            }
        );
}
