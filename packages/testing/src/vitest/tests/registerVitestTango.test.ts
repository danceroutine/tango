import { describe, expect, it, vi } from 'vitest';
import { anIntegrationHarness, type IntegrationHarness } from '../../integration';
import type { TangoVitestHelpers } from '../registerVitestTango';

describe('registerVitestTango', () => {
    it('exposes the vitest helpers for integration workflows', async () => {
        const assertMigrationPlan = vi.fn(async () => 'plan');
        const applyAndVerifyMigrations = vi.fn(async () => ({ statuses: [{ id: '001', applied: true }] }));
        const introspectSchema = vi.fn(async () => ({ tables: [] }));
        const seedTable = vi.fn(async () => {});
        const createQuerySetFixture = vi.fn(() => ({ meta: { table: 'users' } }));
        const expectQueryResult = vi.fn(async () => {});
        const getRegistry = vi.fn(() => ({ list: () => [] }));

        vi.resetModules();
        vi.doMock('../../integration', () => ({
            TestHarness: { getRegistry },
            assertMigrationPlan,
            applyAndVerifyMigrations,
            introspectSchema,
            seedTable,
            createQuerySetFixture,
            expectQueryResult,
        }));

        await import('../registerVitestTango');
        const helpers = (vi as unknown as { tango: TangoVitestHelpers }).tango;
        const harness: IntegrationHarness = anIntegrationHarness();

        await helpers.useHarness(() => harness);
        await helpers.useHarness(harness);
        expect(helpers.getTestHarness()).toBe(harness);
        expect(helpers.getRegistry()).toEqual({ list: expect.any(Function) });

        await expect(helpers.assertMigrationPlan({ migrationsDir: '/tmp' })).resolves.toBe('plan');
        await expect(helpers.applyAndVerifyMigrations({ migrationsDir: '/tmp' })).resolves.toEqual({
            statuses: [{ id: '001', applied: true }],
        });
        await expect(helpers.introspectSchema()).resolves.toEqual({ tables: [] });
        await helpers.seedTable('users', [{ id: 1 }]);
        helpers.createQuerySetFixture({ meta: { table: 'users', pk: 'id', columns: {} }, harness });
        helpers.createQuerySetFixture({ meta: { table: 'users', pk: 'id', columns: {} } });
        await helpers.expectQueryResult([1], [1]);

        expect(assertMigrationPlan).toHaveBeenCalled();
        expect(applyAndVerifyMigrations).toHaveBeenCalled();
        expect(introspectSchema).toHaveBeenCalled();
        expect(seedTable).toHaveBeenCalled();
        expect(createQuerySetFixture).toHaveBeenCalled();
        expect(expectQueryResult).toHaveBeenCalled();
    });

    it('throws for getTestHarness before useHarness and matcher handles non-Error throws', async () => {
        vi.resetModules();
        vi.doMock('../../integration', () => ({
            TestHarness: { getRegistry: () => ({}) },
            assertMigrationPlan: vi.fn(),
            applyAndVerifyMigrations: vi.fn(),
            introspectSchema: vi.fn(),
            seedTable: vi.fn(),
            createQuerySetFixture: vi.fn(),
            expectQueryResult: vi.fn(),
        }));

        await import('../registerVitestTango');
        const helpers = (vi as unknown as { tango: TangoVitestHelpers }).tango;
        expect(() => helpers.getTestHarness()).toThrow('No active test harness');

        const schema = {
            parse() {
                // oxlint-disable-next-line no-throw-literal
                throw 'bad';
            },
        };
        expect({ id: 1 }).not.toMatchSchema(schema);

        const validSchema = {
            parse(data: unknown) {
                return data;
            },
        };
        expect(() => expect('ok').not.toMatchSchema(validSchema)).toThrow('expected data not to match schema');
        expect(() =>
            expect(42).toMatchSchema({
                parse() {
                    throw new Error('bad parse');
                },
            })
        ).toThrow('expected data to match schema');
    });
});
