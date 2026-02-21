import { vi } from 'vitest';
import type { QueryExecutor } from '@danceroutine/tango-orm';
import type { Dialect, TableMeta } from '@danceroutine/tango-orm/query';
import { aDBClient } from './aDBClient';

export type QueryExecutorOverrides<TModel extends Record<string, unknown>> = {
    dialect?: Dialect;
    meta?: TableMeta;
    query?: (sql: string, params?: readonly unknown[]) => Promise<{ rows: unknown[] }>;
    run?: QueryExecutor<TModel>['run'];
};

/**
 * Create a minimal `QueryExecutor` test double for `QuerySet` tests.
 */
export function aQueryExecutor<TModel extends Record<string, unknown>>(
    overrides: QueryExecutorOverrides<TModel> = {}
): QueryExecutor<TModel> {
    const dialect = overrides.dialect ?? 'postgres';
    const meta: TableMeta = overrides.meta ?? { table: 'mock_table', pk: 'id', columns: {} };
    const run = overrides.run ?? vi.fn(async () => [] as TModel[]);
    const client = aDBClient(overrides.query ? { query: overrides.query } : {});

    return { meta, client, dialect, run };
}
