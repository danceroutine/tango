import { createDefaultIntrospectorStrategy } from '@danceroutine/tango-migrations';
import type { Dialect as MigrationDialect } from '@danceroutine/tango-migrations';
import { Dialect, type IntegrationHarness } from '../domain';

const introspectorStrategy = createDefaultIntrospectorStrategy();

/**
 * Introspect the schema visible to a harness using Tango's built-in introspectors.
 */
export async function introspectSchema(harness: IntegrationHarness): Promise<unknown> {
    if (harness.dialect !== Dialect.Postgres && harness.dialect !== Dialect.Sqlite) {
        throw new Error(`No introspector registered for dialect: ${String(harness.dialect)}`);
    }
    const dialect = harness.dialect === Dialect.Postgres ? 'postgres' : 'sqlite';
    return introspectorStrategy.introspect(dialect as unknown as MigrationDialect, harness.dbClient);
}
