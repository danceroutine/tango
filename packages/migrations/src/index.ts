export { trustedSql } from '@danceroutine/tango-core';
export type { TrustedSqlFragment } from '@danceroutine/tango-core';

/**
 * Bundled exports for Django-style domain drill-down imports, plus curated
 * top-level symbols for TS-native ergonomic imports.
 */
export * as domain from './domain/index';
export * as builder from './builder/index';
export * as runner from './runner/index';
export * as generator from './generator/index';
export * as diff from './diff/index';
export * as compilers from './compilers/index';
export * as introspect from './introspect/index';
export * as strategies from './strategies/index';
export * as commands from './commands/index';

export { Migration } from './domain/index';
export type { Dialect, MigrationMode, MigrationOperation } from './domain/index';
export type {
    Builder,
    ColumnSpec,
    ColumnType,
    DeleteReferentialAction,
    UpdateReferentialAction,
} from './builder/index';
export { CollectingBuilder, OpBuilder, op, applyFieldType } from './builder/index';
export { MigrationRunner } from './runner/index';
export { MigrationGenerator, type GenerateMigrationOptions } from './generator/index';
export { diffSchema } from './diff/index';
export { PostgresCompiler, SqliteCompiler } from './compilers/index';
export type { CompilerFactory, SQL, SQLCompiler } from './compilers/index';
export {
    CompilerStrategy,
    IntrospectorStrategy,
    createDefaultCompilerStrategy,
    createDefaultIntrospectorStrategy,
} from './strategies/index';
export { registerMigrationsCommands } from './commands/index';
export {
    PostgresIntrospector,
    SqliteIntrospector,
    type DatabaseIntrospector,
    type DBClient,
    type PostgresDbColumn,
    type PostgresDbForeignKey,
    type PostgresDbIndex,
    type PostgresDbSchema,
    type PostgresDbTable,
    type SqliteDbColumn,
    type SqliteDbSchema,
    type SqliteDbTable,
} from './introspect/index';
