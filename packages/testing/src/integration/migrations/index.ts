/**
 * Domain boundary barrel: centralizes this subdomain's public contract.
 */

export { assertMigrationPlan, type AssertMigrationPlanOptions } from './AssertMigrationPlan';
export {
    applyAndVerifyMigrations,
    type ApplyAndVerifyMigrationsOptions,
    type MigrationStatus,
} from './ApplyAndVerifyMigrations';
export { introspectSchema } from './IntrospectSchema';
