import type { IntegrationHarness } from '../domain';

export type AssertMigrationPlanOptions = {
    migrationsDir: string;
    expectSqlContains?: string[];
};

/**
 * Generate a migration plan through a harness and assert that required SQL fragments appear.
 */
export async function assertMigrationPlan(
    harness: IntegrationHarness,
    options: AssertMigrationPlanOptions
): Promise<string> {
    const runner = harness.migrationRunner(options.migrationsDir);
    const plan = await runner.plan();

    for (const snippet of options.expectSqlContains ?? []) {
        if (!plan.includes(snippet)) {
            throw new Error(`Expected migration plan to contain: ${snippet}`);
        }
    }

    return plan;
}
