import { describe, it, expect } from 'vitest';
import { CompilerStrategy, createDefaultCompilerStrategy } from '../CompilerStrategy';
import { InternalDialect } from '../../domain/internal/InternalDialect';
import { InternalOperationKind } from '../../domain/internal/InternalOperationKind';
import type { CompilerFactory } from '../../compilers/contracts/CompilerFactory';

describe(CompilerStrategy, () => {
    it('dispatches to the compiler registered for a dialect', () => {
        const fakeFactory: CompilerFactory = {
            create: () => ({
                prepareOperations: (operations) => operations,
                compile: () => [{ sql: '-- fake', params: [] }],
            }),
        };
        const strategy = new CompilerStrategy({
            [InternalDialect.POSTGRES]: fakeFactory,
            [InternalDialect.SQLITE]: fakeFactory,
        });

        const sql = strategy.compile(InternalDialect.POSTGRES, {
            kind: InternalOperationKind.TABLE_DROP,
            table: 'users',
        });

        expect(sql).toEqual([{ sql: '-- fake', params: [] }]);
    });

    it('default strategy supports postgres and sqlite', () => {
        const strategy = createDefaultCompilerStrategy();
        const sql = strategy.compile(InternalDialect.SQLITE, {
            kind: InternalOperationKind.TABLE_DROP,
            table: 'users',
        });

        expect(sql[0]?.sql).toContain('DROP TABLE');
    });

    it('caches compilers per dialect', () => {
        let createCalls = 0;
        const fakeFactory: CompilerFactory = {
            create: () => {
                createCalls += 1;
                return {
                    prepareOperations: (operations) => operations,
                    compile: () => [{ sql: '-- fake', params: [] }],
                };
            },
        };

        const strategy = new CompilerStrategy({
            [InternalDialect.POSTGRES]: fakeFactory,
            [InternalDialect.SQLITE]: fakeFactory,
        });

        strategy.compile(InternalDialect.POSTGRES, {
            kind: InternalOperationKind.TABLE_DROP,
            table: 'users',
        });
        strategy.compile(InternalDialect.POSTGRES, {
            kind: InternalOperationKind.TABLE_DROP,
            table: 'users',
        });

        expect(createCalls).toBe(1);
    });

    it('returns operations unchanged when the compiler has no prepare hook', () => {
        const fakeFactory: CompilerFactory = {
            create: () =>
                ({
                    compile: () => [{ sql: '-- fake', params: [] }],
                }) as ReturnType<CompilerFactory['create']>,
        };

        const strategy = new CompilerStrategy({
            [InternalDialect.POSTGRES]: fakeFactory,
            [InternalDialect.SQLITE]: fakeFactory,
        });
        const operations = [{ kind: InternalOperationKind.TABLE_DROP, table: 'users' }] as const;

        expect(strategy.prepareOperations(InternalDialect.POSTGRES, [...operations])).toEqual(operations);
    });

    it('accepts custom compiler handlers and rejects unknown dialects', () => {
        const fakeFactory: CompilerFactory = {
            create: () => ({
                prepareOperations: (operations) => operations,
                compile: () => [{ sql: '-- fake', params: [] }],
            }),
        };
        const strategy = new CompilerStrategy({
            [InternalDialect.POSTGRES]: fakeFactory,
            [InternalDialect.SQLITE]: fakeFactory,
        });

        expect(CompilerStrategy.isCompilerStrategy(strategy)).toBe(true);
        expect(CompilerStrategy.isCompilerStrategy({})).toBe(false);

        strategy.registerCustomHandler('reindex', (_dialect, op) => [{ sql: `-- ${op.name}`, params: [] }]);
        expect(
            strategy.compile(InternalDialect.POSTGRES, {
                kind: 'custom',
                name: 'reindex',
                args: { table: 'users' },
            })
        ).toEqual([{ sql: '-- reindex', params: [] }]);

        expect(() =>
            strategy.compile(InternalDialect.POSTGRES, {
                kind: 'custom',
                name: 'unknown',
                args: {},
            })
        ).toThrow('Unsupported custom migration op: unknown');

        expect(() => strategy.getCompiler('mysql' as unknown as 'postgres')).toThrow(
            'No SQL compiler factory registered for dialect: mysql'
        );
    });
});
