import { QuerySet, type QueryExecutor } from '@danceroutine/tango-orm';
import type { TableMeta } from '@danceroutine/tango-orm/query';
import { Dialect, type IntegrationHarness } from '../domain/index';

/**
 * Create a `QuerySet` fixture backed by a real integration harness and supplied table metadata.
 */
export function createQuerySetFixture<TModel extends Record<string, unknown>>(input: {
    harness: IntegrationHarness;
    meta: TableMeta;
}): QuerySet<TModel> {
    const executor: QueryExecutor<TModel> = {
        meta: input.meta,
        client: input.harness.dbClient,
        dialect: input.harness.dialect as Dialect,
        run: async (compiled) => {
            const result = await input.harness.dbClient.query<TModel>(compiled.sql, compiled.params);
            return result.rows;
        },
    };

    return new QuerySet<TModel>(executor);
}
