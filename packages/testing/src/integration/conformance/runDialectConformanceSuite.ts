import type { HarnessOptions, HarnessStrategy } from '../domain';

/**
 * Shared conformance checks every harness strategy must satisfy.
 *
 * This is intentionally framework-agnostic so first-party and third-party
 * strategies can run the same lifecycle validation.
 */
export async function runDialectConformanceSuite(
    strategy: HarnessStrategy,
    options: {
        createOptions?: HarnessOptions;
        migrationsDir?: string;
    } = {}
): Promise<void> {
    const harness = await strategy.create(options.createOptions);

    if (harness.dialect !== strategy.dialect) {
        throw new Error(
            `Conformance failed: harness dialect '${String(harness.dialect)}' does not match strategy dialect '${String(strategy.dialect)}'`
        );
    }

    if (harness.capabilities !== strategy.capabilities) {
        throw new Error('Conformance failed: harness capabilities must be strategy capabilities reference');
    }

    let resetBeforeSetupThrew = false;
    try {
        await harness.reset();
    } catch {
        resetBeforeSetupThrew = true;
    }
    if (!resetBeforeSetupThrew) {
        throw new Error('Conformance failed: reset() must throw before setup()');
    }

    await harness.setup();
    await harness.reset();
    harness.migrationRunner(options.migrationsDir ?? '/tmp/migrations');
    await harness.teardown();

    let dbClientAfterTeardownThrew = false;
    try {
        // Access after teardown should fail to prevent stale client usage.

        // oxlint-disable-next-line no-unused-expressions
        harness.dbClient;
    } catch {
        dbClientAfterTeardownThrew = true;
    }
    if (!dbClientAfterTeardownThrew) {
        throw new Error('Conformance failed: dbClient getter must throw after teardown()');
    }
}
