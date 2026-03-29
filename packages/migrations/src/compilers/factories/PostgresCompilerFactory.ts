import type { CompilerFactory } from '../contracts/CompilerFactory';
import type { SQLCompiler } from '../contracts/SQLCompiler';
import { PostgresCompiler } from '../dialects/PostgresCompiler';

/**
 * Factory for PostgreSQL migration compilers.
 */
export class PostgresCompilerFactory implements CompilerFactory {
    static readonly BRAND = 'tango.migrations.postgres_compiler_factory' as const;
    readonly __tangoBrand: typeof PostgresCompilerFactory.BRAND = PostgresCompilerFactory.BRAND;

    /**
     * Narrow an unknown value to the factory that provisions PostgreSQL compilers.
     */
    static isPostgresCompilerFactory(value: unknown): value is PostgresCompilerFactory {
        return (
            typeof value === 'object' &&
            value !== null &&
            (value as { __tangoBrand?: unknown }).__tangoBrand === PostgresCompilerFactory.BRAND
        );
    }

    /**
     * Create a PostgreSQL SQL compiler instance.
     */
    create(): SQLCompiler {
        return new PostgresCompiler();
    }
}
