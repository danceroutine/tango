import type { CompiledQuery } from '../../query/domain/index';
import type { Adapter, SqlPlaceholders } from '../../connection/adapters/Adapter';
import type {
    ValidatedDeleteSqlPlan,
    ValidatedInsertSqlPlan,
    ValidatedSelectSqlPlan,
    ValidatedUpdateSqlPlan,
} from '../../validation/SQLValidationEngine';

export const InternalDuplicateInsertPolicy = {
    ERROR: 'error',
    IGNORE: 'ignore',
} as const;

export type DuplicateInsertPolicy = (typeof InternalDuplicateInsertPolicy)[keyof typeof InternalDuplicateInsertPolicy];

/**
 * Internal compiler for manager-owned INSERT/UPDATE/DELETE statements.
 */
export class MutationCompiler {
    private readonly adapter: Adapter;
    private readonly placeholders: SqlPlaceholders;

    constructor(adapter: Adapter) {
        this.adapter = adapter;
        this.placeholders = adapter.placeholders;
    }

    compileInsert(plan: ValidatedInsertSqlPlan, values: readonly unknown[]): CompiledQuery {
        return {
            sql: `INSERT INTO ${plan.meta.table} (${plan.writeKeys.join(', ')}) VALUES (${this.placeholders.list(plan.writeKeys.length)}) RETURNING *`,
            params: values,
        };
    }

    compileUpdate(plan: ValidatedUpdateSqlPlan, values: readonly unknown[], id: unknown): CompiledQuery {
        const sets = plan.writeKeys.map((key, index) => `${key} = ${this.placeholders.at(index + 1)}`).join(', ');
        const whereParam = this.placeholders.at(plan.writeKeys.length + 1);

        return {
            sql: `UPDATE ${plan.meta.table} SET ${sets} WHERE ${plan.meta.pk} = ${whereParam} RETURNING *`,
            params: [...values, id],
        };
    }

    compileDelete(plan: ValidatedDeleteSqlPlan, id: unknown): CompiledQuery {
        return {
            sql: `DELETE FROM ${plan.meta.table} WHERE ${plan.meta.pk} = ${this.placeholders.at(1)}`,
            params: [id],
        };
    }

    compileDeleteByJoinKeys(
        plan: ValidatedSelectSqlPlan,
        leftFilterKey: string,
        rightFilterKey: string,
        leftValue: unknown,
        rightValue: unknown
    ): CompiledQuery {
        const leftDescriptor = plan.filterKeys[leftFilterKey];
        const rightDescriptor = plan.filterKeys[rightFilterKey];
        if (!leftDescriptor || !rightDescriptor) {
            throw new Error(
                `MutationCompiler.compileDeleteByJoinKeys: filter keys '${leftFilterKey}' and '${rightFilterKey}' must be present on the validated plan.`
            );
        }
        return {
            sql: `DELETE FROM ${plan.meta.table} WHERE ${leftDescriptor.field} = ${this.placeholders.at(
                1
            )} AND ${rightDescriptor.field} = ${this.placeholders.at(2)}`,
            params: [leftValue, rightValue],
        };
    }

    compileBulkInsert(plan: ValidatedInsertSqlPlan, valueRows: ReadonlyArray<ReadonlyArray<unknown>>): CompiledQuery {
        const columnCount = plan.writeKeys.length;
        const placeholders = valueRows
            .map((_row, rowIndex) => `(${this.placeholders.listFromOffset(columnCount, rowIndex * columnCount)})`)
            .join(', ');

        return {
            sql: `INSERT INTO ${plan.meta.table} (${plan.writeKeys.join(', ')}) VALUES ${placeholders} RETURNING *`,
            params: valueRows.flat(),
        };
    }

    compileInsertJoinLinks(
        plan: ValidatedInsertSqlPlan,
        sourceKey: string,
        targetKey: string,
        ownerValue: unknown,
        targetValues: readonly unknown[],
        duplicatePolicy: DuplicateInsertPolicy
    ): CompiledQuery {
        const valueRows = targetValues.map((targetValue) => [ownerValue, targetValue]);
        const placeholders = valueRows
            .map((_row, rowIndex) => `(${this.placeholders.listFromOffset(2, rowIndex * 2)})`)
            .join(', ');
        const params = valueRows.flat();

        if (duplicatePolicy === InternalDuplicateInsertPolicy.IGNORE) {
            switch (this.adapter.dialect) {
                case 'postgres':
                    return {
                        sql: `INSERT INTO ${plan.meta.table} (${plan.writeKeys.join(', ')}) VALUES ${placeholders} ON CONFLICT (${sourceKey}, ${targetKey}) DO NOTHING`,
                        params,
                    };
                case 'sqlite':
                    return {
                        sql: `INSERT OR IGNORE INTO ${plan.meta.table} (${plan.writeKeys.join(', ')}) VALUES ${placeholders}`,
                        params,
                    };
            }
        }

        return {
            sql: `INSERT INTO ${plan.meta.table} (${plan.writeKeys.join(', ')}) VALUES ${placeholders}`,
            params,
        };
    }

    compileDeleteJoinLinks(
        plan: ValidatedSelectSqlPlan,
        leftFilterKey: string,
        rightFilterKey: string,
        leftValue: unknown,
        rightValues: readonly unknown[]
    ): CompiledQuery {
        const leftDescriptor = plan.filterKeys[leftFilterKey];
        const rightDescriptor = plan.filterKeys[rightFilterKey];
        if (!leftDescriptor || !rightDescriptor) {
            throw new Error(
                `MutationCompiler.compileDeleteJoinLinks: filter keys '${leftFilterKey}' and '${rightFilterKey}' must be present on the validated plan.`
            );
        }
        if (rightValues.length === 0) {
            throw new Error('MutationCompiler.compileDeleteJoinLinks requires at least one target value.');
        }
        if (rightValues.length === 1) {
            return {
                sql: `DELETE FROM ${plan.meta.table} WHERE ${leftDescriptor.field} = ${this.placeholders.at(
                    1
                )} AND ${rightDescriptor.field} = ${this.placeholders.at(2)}`,
                params: [leftValue, rightValues[0]],
            };
        }

        return {
            sql: `DELETE FROM ${plan.meta.table} WHERE ${leftDescriptor.field} = ${this.placeholders.at(
                1
            )} AND ${rightDescriptor.field} IN (${this.placeholders.listFromOffset(rightValues.length, 1)})`,
            params: [leftValue, ...rightValues],
        };
    }
}
