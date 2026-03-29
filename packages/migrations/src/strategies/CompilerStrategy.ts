import { PostgresCompilerFactory } from '../compilers/factories/PostgresCompilerFactory';
import { SqliteCompilerFactory } from '../compilers/factories/SqliteCompilerFactory';
import type { CompilerFactory } from '../compilers/contracts/CompilerFactory';
import type { Dialect } from '../domain/Dialect';
import type { CustomMigrationOperation, MigrationOperation } from '../domain/MigrationOperation';
import type { SQL } from '../compilers/contracts/SQL';
import type { SQLCompiler } from '../compilers/contracts/SQLCompiler';
import { InternalDialect } from '../domain/internal/InternalDialect';

type CompilerFactoryRegistry = Record<Dialect, CompilerFactory>;

/**
 * Dialect-aware SQL compiler orchestration with optional custom-op handlers.
 */
export class CompilerStrategy {
    static readonly BRAND = 'tango.migrations.compiler_strategy' as const;
    readonly __tangoBrand: typeof CompilerStrategy.BRAND = CompilerStrategy.BRAND;
    private readonly compilerCache = new Map<Dialect, SQLCompiler>();
    private readonly customHandlers = new Map<string, (dialect: Dialect, op: CustomMigrationOperation) => SQL[]>();

    constructor(private readonly factories: CompilerFactoryRegistry) {}

    /**
     * Narrow an unknown value to the dialect-aware migration compiler strategy.
     */
    static isCompilerStrategy(value: unknown): value is CompilerStrategy {
        return (
            typeof value === 'object' &&
            value !== null &&
            (value as { __tangoBrand?: unknown }).__tangoBrand === CompilerStrategy.BRAND
        );
    }

    /**
     * Compile a migration operation to SQL for a target dialect.
     */
    compile(dialect: Dialect, operation: MigrationOperation): SQL[] {
        if (operation.kind === 'custom') {
            const handler = this.customHandlers.get(operation.name);
            if (!handler) {
                throw new Error(`Unsupported custom migration op: ${operation.name}`);
            }
            return handler(dialect, operation);
        }
        const compiler = this.getCompiler(dialect);
        return compiler.compile(operation);
    }

    /**
     * Register a handler for custom migration operations.
     */
    registerCustomHandler<TName extends string, TArgs extends object>(
        name: TName,
        handler: (dialect: Dialect, op: CustomMigrationOperation<TName, TArgs>) => SQL[]
    ): this {
        this.customHandlers.set(name, handler as (dialect: Dialect, op: CustomMigrationOperation) => SQL[]);
        return this;
    }

    /**
     * Resolve and cache a compiler instance for a dialect.
     */
    getCompiler(dialect: Dialect): SQLCompiler {
        const cached = this.compilerCache.get(dialect);
        if (cached) {
            return cached;
        }

        const factory = this.factories[dialect];
        if (!factory) {
            throw new Error(`No SQL compiler factory registered for dialect: ${String(dialect)}`);
        }
        const compiler = factory.create();
        this.compilerCache.set(dialect, compiler);
        return compiler;
    }
}

/**
 * Create the default compiler strategy with built-in dialect factories.
 */
export function createDefaultCompilerStrategy(): CompilerStrategy {
    return new CompilerStrategy({
        [InternalDialect.POSTGRES]: new PostgresCompilerFactory(),
        [InternalDialect.SQLITE]: new SqliteCompilerFactory(),
    });
}
