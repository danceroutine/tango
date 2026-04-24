/**
 * Discriminator strings for {@link SqlValidationPlan} / {@link ValidatedSqlPlan}: which validation
 * branch {@link OrmSqlSafetyAdapter} runs before SQL is assembled or executed.
 */
export const InternalSqlValidationPlanKind = {
    /**
     * Read/query validation: table metadata, projected columns, `WHERE` filter keys, ordering, and
     * optional relation handles. Used when compiling selects (including M2M through-table selects
     * issued inside prefetch compilation).
     */
    SELECT: 'select',

    /**
     * Insert validation: resolved write columns for `INSERT … VALUES`.
     */
    INSERT: 'insert',

    /**
     * Update validation: resolved write columns for `UPDATE … SET`.
     */
    UPDATE: 'update',

    /**
     * Delete validation: scope delete-by-primary-key against validated table metadata.
     */
    DELETE: 'delete',
} as const;

export type SqlValidationPlanKind = (typeof InternalSqlValidationPlanKind)[keyof typeof InternalSqlValidationPlanKind];
