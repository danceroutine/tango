import type { CompiledQuery, Dialect } from '../../query/domain/index';
import type {
    ValidatedDeleteSqlPlan,
    ValidatedInsertSqlPlan,
    ValidatedUpdateSqlPlan,
} from '../../validation/SQLValidationEngine';

/**
 * Internal compiler for manager-owned INSERT/UPDATE/DELETE statements.
 */
export class MutationCompiler {
    constructor(private readonly dialect: Dialect) {}

    compileInsert(plan: ValidatedInsertSqlPlan, values: readonly unknown[]): CompiledQuery {
        return {
            sql: `INSERT INTO ${plan.meta.table} (${plan.writeKeys.join(', ')}) VALUES (${this.buildValuePlaceholders(plan.writeKeys.length)}) RETURNING *`,
            params: values,
        };
    }

    compileUpdate(plan: ValidatedUpdateSqlPlan, values: readonly unknown[], id: unknown): CompiledQuery {
        const sets = plan.writeKeys.map((key, index) => `${key} = ${this.placeholder(index + 1)}`).join(', ');
        const whereParam = this.placeholder(plan.writeKeys.length + 1);

        return {
            sql: `UPDATE ${plan.meta.table} SET ${sets} WHERE ${plan.meta.pk} = ${whereParam} RETURNING *`,
            params: [...values, id],
        };
    }

    compileDelete(plan: ValidatedDeleteSqlPlan, id: unknown): CompiledQuery {
        return {
            sql: `DELETE FROM ${plan.meta.table} WHERE ${plan.meta.pk} = ${this.placeholder(1)}`,
            params: [id],
        };
    }

    compileBulkInsert(plan: ValidatedInsertSqlPlan, valueRows: ReadonlyArray<ReadonlyArray<unknown>>): CompiledQuery {
        const columnCount = plan.writeKeys.length;
        const placeholders = valueRows
            .map((_row, rowIndex) => {
                const offset = rowIndex * columnCount;
                return `(${plan.writeKeys.map((_, colIndex) => this.placeholder(offset + colIndex + 1)).join(', ')})`;
            })
            .join(', ');

        return {
            sql: `INSERT INTO ${plan.meta.table} (${plan.writeKeys.join(', ')}) VALUES ${placeholders} RETURNING *`,
            params: valueRows.flat(),
        };
    }

    private buildValuePlaceholders(count: number): string {
        return Array.from({ length: count }, (_value, index) => this.placeholder(index + 1)).join(', ');
    }

    private placeholder(index: number): string {
        return this.dialect === 'postgres' ? `$${index}` : '?';
    }
}
