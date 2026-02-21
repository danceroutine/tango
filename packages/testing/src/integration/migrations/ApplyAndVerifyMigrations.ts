import type { IntegrationHarness } from '../domain';

export type ApplyAndVerifyMigrationsOptions = {
    migrationsDir: string;
    toId?: string;
    expectedAppliedIds?: string[];
};

export type MigrationStatus = { id: string; applied: boolean };

/**
 * Apply migrations through a harness and optionally verify that specific ids were applied.
 */
export async function applyAndVerifyMigrations(
    harness: IntegrationHarness,
    options: ApplyAndVerifyMigrationsOptions
): Promise<{ statuses: MigrationStatus[] }> {
    const runner = harness.migrationRunner(options.migrationsDir);
    await runner.apply(options.toId);
    const statuses = await runner.status();

    for (const id of options.expectedAppliedIds ?? []) {
        const row = statuses.find((status: MigrationStatus) => status.id === id);
        if (!row || !row.applied) {
            throw new Error(`Expected migration ${id} to be applied`);
        }
    }

    return { statuses };
}
