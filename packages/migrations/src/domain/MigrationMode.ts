import type { InternalMigrationMode } from './internal/InternalMigrationMode';

export type MigrationMode = (typeof InternalMigrationMode)[keyof typeof InternalMigrationMode];
