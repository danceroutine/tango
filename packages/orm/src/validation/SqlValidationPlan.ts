import type { TableMeta } from '../query/domain/TableMeta';
import { InternalSqlValidationPlanKind as SqlPlanKind } from './internal/InternalSqlValidationPlanKind';

/**
 * Validation request for read/query compilation.
 *
 * The ORM uses this plan to validate selected fields, filter keys, ordering,
 * and relation names before SQL is assembled.
 */
export type SelectSqlValidationPlan = {
    kind: typeof SqlPlanKind.SELECT;
    meta: TableMeta;
    selectFields?: readonly string[];
    filterKeys?: readonly string[];
    orderFields?: readonly string[];
    relationNames?: readonly string[];
};

/**
 * Validation request for insert statements.
 */
export type InsertSqlValidationPlan = {
    kind: typeof SqlPlanKind.INSERT;
    meta: TableMeta;
    writeKeys: readonly string[];
};

/**
 * Validation request for update statements.
 */
export type UpdateSqlValidationPlan = {
    kind: typeof SqlPlanKind.UPDATE;
    meta: TableMeta;
    writeKeys: readonly string[];
};

/**
 * Validation request for delete statements.
 */
export type DeleteSqlValidationPlan = {
    kind: typeof SqlPlanKind.DELETE;
    meta: TableMeta;
};

/**
 * ORM-local SQL validation requests routed through `OrmSqlSafetyAdapter`.
 */
export type SqlValidationPlan =
    | SelectSqlValidationPlan
    | InsertSqlValidationPlan
    | UpdateSqlValidationPlan
    | DeleteSqlValidationPlan;
