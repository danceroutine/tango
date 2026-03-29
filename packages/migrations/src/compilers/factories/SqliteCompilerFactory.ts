import type { CompilerFactory } from '../contracts/CompilerFactory';
import type { SQLCompiler } from '../contracts/SQLCompiler';
import { SqliteCompiler } from '../dialects/SqliteCompiler';

/**
 * Factory for SQLite migration compilers.
 */
export class SqliteCompilerFactory implements CompilerFactory {
    static readonly BRAND = 'tango.migrations.sqlite_compiler_factory' as const;
    readonly __tangoBrand: typeof SqliteCompilerFactory.BRAND = SqliteCompilerFactory.BRAND;

    /**
     * Narrow an unknown value to the factory that provisions SQLite compilers.
     */
    static isSqliteCompilerFactory(value: unknown): value is SqliteCompilerFactory {
        return (
            typeof value === 'object' &&
            value !== null &&
            (value as { __tangoBrand?: unknown }).__tangoBrand === SqliteCompilerFactory.BRAND
        );
    }

    /**
     * Create a SQLite SQL compiler instance.
     */
    create(): SQLCompiler {
        return new SqliteCompiler();
    }
}
