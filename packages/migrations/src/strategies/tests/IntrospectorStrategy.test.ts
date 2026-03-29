import { describe, expect, it, vi } from 'vitest';
import { IntrospectorStrategy, createDefaultIntrospectorStrategy } from '../IntrospectorStrategy';
import { InternalDialect } from '../../domain/internal/InternalDialect';

describe(IntrospectorStrategy, () => {
    it('dispatches to registered introspector and caches instances', async () => {
        let createCalls = 0;
        const introspect = vi.fn(async () => ({ tables: {} }));
        const strategy = new IntrospectorStrategy({
            [InternalDialect.POSTGRES]: {
                create: () => {
                    createCalls += 1;
                    return { introspect };
                },
            },
            [InternalDialect.SQLITE]: {
                create: () => ({ introspect }),
            },
        });

        expect(IntrospectorStrategy.isIntrospectorStrategy(strategy)).toBe(true);
        expect(IntrospectorStrategy.isIntrospectorStrategy({})).toBe(false);
        await expect(strategy.introspect(InternalDialect.POSTGRES, { query: vi.fn() })).resolves.toEqual({
            tables: {},
        });
        strategy.getIntrospector(InternalDialect.POSTGRES);
        strategy.getIntrospector(InternalDialect.POSTGRES);
        expect(createCalls).toBe(1);
    });

    it('throws when no introspector factory exists for a dialect', () => {
        const strategy = new IntrospectorStrategy({
            [InternalDialect.POSTGRES]: { create: () => ({ introspect: vi.fn() }) },
            [InternalDialect.SQLITE]: { create: () => ({ introspect: vi.fn() }) },
        });

        expect(() => strategy.getIntrospector('mysql' as unknown as 'postgres')).toThrow(
            'No database introspector factory registered for dialect: mysql'
        );
    });

    it('default strategy supports sqlite and postgres', async () => {
        const strategy = createDefaultIntrospectorStrategy();
        const sqliteClient = {
            query: vi.fn(async (sql: string) => {
                if (sql.includes('sqlite_master')) return { rows: [] };
                return { rows: [] };
            }),
        };
        await expect(strategy.introspect(InternalDialect.SQLITE, sqliteClient)).resolves.toEqual({ tables: {} });

        const postgresClient = {
            query: vi.fn(async (sql: string) => {
                if (sql.includes('FROM pg_class')) return { rows: [] };
                return { rows: [] };
            }),
        };
        await expect(strategy.introspect(InternalDialect.POSTGRES, postgresClient)).resolves.toEqual({ tables: {} });
    });
});
