/**
 * Vitest custom matchers and helpers for Tango.
 *
 * Import this module in your Vitest setup file:
 *
 * ```typescript
 * import '@danceroutine/tango-testing/vitest';
 * ```
 */
import { expect, vi } from 'vitest';
import { getLogger } from '@danceroutine/tango-core';
import {
    TestHarness,
    applyAndVerifyMigrations as applyAndVerifyMigrationsFn,
    assertMigrationPlan as assertMigrationPlanFn,
    createModelQuerySetFixture as createModelQuerySetFixtureFn,
    expectQueryResult as expectQueryResultFn,
    introspectSchema as introspectSchemaFn,
    seedTable as seedTableFn,
    type ApplyAndVerifyMigrationsOptions,
    type AssertMigrationPlanOptions,
    type HarnessStrategyRegistry,
    type IntegrationHarness,
} from '../integration';

interface Parseable {
    parse(data: unknown): unknown;
}

function isError(value: unknown): value is Error {
    return (
        typeof value === 'object' &&
        value !== null &&
        typeof (value as { name?: unknown }).name === 'string' &&
        typeof (value as { message?: unknown }).message === 'string'
    );
}

let activeHarness: IntegrationHarness | null = null;
const logger = getLogger('tango.testing.vitest');
let hasWarnedForCreateQuerySetFixture = false;

async function resolveHarness(
    input: IntegrationHarness | (() => IntegrationHarness | Promise<IntegrationHarness>)
): Promise<IntegrationHarness> {
    if (typeof input === 'function') {
        return input();
    }
    return input;
}

export interface TangoVitestHelpers {
    useHarness(
        input: IntegrationHarness | (() => IntegrationHarness | Promise<IntegrationHarness>)
    ): Promise<IntegrationHarness>;
    getTestHarness(): IntegrationHarness;
    getRegistry(): HarnessStrategyRegistry;
    assertMigrationPlan(options: AssertMigrationPlanOptions & { harness?: IntegrationHarness }): Promise<string>;
    applyAndVerifyMigrations(
        options: ApplyAndVerifyMigrationsOptions & { harness?: IntegrationHarness }
    ): Promise<{ statuses: { id: string; applied: boolean }[] }>;
    introspectSchema(harness?: IntegrationHarness): Promise<unknown>;
    seedTable<T extends Record<string, unknown>>(table: string, rows: T[], harness?: IntegrationHarness): Promise<void>;
    createModelQuerySetFixture<TModel extends Record<string, unknown>>(options: {
        meta: import('@danceroutine/tango-orm/query').TableMeta;
        harness?: IntegrationHarness;
    }): import('@danceroutine/tango-orm').QuerySet<TModel>;
    /**
     * @deprecated Use `vi.tango.createModelQuerySetFixture(...)` instead.
     */
    createQuerySetFixture<TModel extends Record<string, unknown>>(options: {
        meta: import('@danceroutine/tango-orm/query').TableMeta;
        harness?: IntegrationHarness;
    }): import('@danceroutine/tango-orm').QuerySet<TModel>;
    expectQueryResult<T>(actual: Promise<T> | T, expected: T): Promise<void>;
}

const tangoHelpers: TangoVitestHelpers = {
    async useHarness(input): Promise<IntegrationHarness> {
        const harness = await resolveHarness(input);
        await harness.setup();
        activeHarness = harness;
        return harness;
    },
    getTestHarness(): IntegrationHarness {
        if (!activeHarness) {
            throw new Error('No active test harness. Call vi.tango.useHarness(...) in beforeAll first.');
        }
        return activeHarness;
    },
    getRegistry(): HarnessStrategyRegistry {
        return TestHarness.getRegistry();
    },
    async assertMigrationPlan(options): Promise<string> {
        const harness = options.harness ?? tangoHelpers.getTestHarness();
        return assertMigrationPlanFn(harness, {
            migrationsDir: options.migrationsDir,
            expectSqlContains: options.expectSqlContains,
        });
    },
    async applyAndVerifyMigrations(options): Promise<{ statuses: { id: string; applied: boolean }[] }> {
        const harness = options.harness ?? tangoHelpers.getTestHarness();
        return applyAndVerifyMigrationsFn(harness, {
            migrationsDir: options.migrationsDir,
            toId: options.toId,
            expectedAppliedIds: options.expectedAppliedIds,
        });
    },
    async introspectSchema(harness?: IntegrationHarness): Promise<unknown> {
        return introspectSchemaFn(harness ?? tangoHelpers.getTestHarness());
    },
    async seedTable<T extends Record<string, unknown>>(
        table: string,
        rows: T[],
        harness?: IntegrationHarness
    ): Promise<void> {
        await seedTableFn(harness ?? tangoHelpers.getTestHarness(), table, rows);
    },
    createModelQuerySetFixture<TModel extends Record<string, unknown>>(options: {
        meta: import('@danceroutine/tango-orm/query').TableMeta;
        harness?: IntegrationHarness;
    }): import('@danceroutine/tango-orm').QuerySet<TModel> {
        return createModelQuerySetFixtureFn<TModel>({
            harness: options.harness ?? tangoHelpers.getTestHarness(),
            meta: options.meta,
        });
    },
    createQuerySetFixture<TModel extends Record<string, unknown>>(options: {
        meta: import('@danceroutine/tango-orm/query').TableMeta;
        harness?: IntegrationHarness;
    }): import('@danceroutine/tango-orm').QuerySet<TModel> {
        if (!hasWarnedForCreateQuerySetFixture) {
            hasWarnedForCreateQuerySetFixture = true;
            logger.warn(
                '`vi.tango.createQuerySetFixture(...)` is deprecated. Use `vi.tango.createModelQuerySetFixture(...)` instead.'
            );
        }
        return createModelQuerySetFixtureFn<TModel>({
            harness: options.harness ?? tangoHelpers.getTestHarness(),
            meta: options.meta,
        });
    },
    async expectQueryResult<T>(actual: Promise<T> | T, expected: T): Promise<void> {
        await expectQueryResultFn(actual, expected);
    },
};

expect.extend({
    toMatchSchema(received: unknown, schema: Parseable) {
        try {
            schema.parse(received);
            return {
                pass: true,
                message: () => 'expected data not to match schema',
            };
        } catch (error) {
            const detail = isError(error) ? error.message : String(error);
            return {
                pass: false,
                message: () => `expected data to match schema\n\n${detail}`,
            };
        }
    },
});

(vi as unknown as { tango?: TangoVitestHelpers }).tango = tangoHelpers;

declare module 'vitest' {
    // oxlint-disable-next-line no-unused-vars
    interface Assertion<T> {
        toMatchSchema(schema: Parseable): void;
    }

    interface AsymmetricMatchersContaining {
        toMatchSchema(schema: Parseable): void;
    }

    interface VitestUtils {
        tango: TangoVitestHelpers;
    }
}
