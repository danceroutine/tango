import type { Dialect } from '../domain/Dialect';
import { InternalDialect as InternalDialectValue } from '../domain/internal/InternalDialect';

export type QueryRowColumnMap = Record<string, string>;

export interface QueryRowNormalizerStrategy {
    normalizeRootRows<TRow extends Record<string, unknown>>(rows: readonly TRow[], columns: QueryRowColumnMap): TRow[];
    normalizeHydratedRowsForParserShape<TRow extends Record<string, unknown>>(
        rows: readonly TRow[],
        columns: QueryRowColumnMap
    ): TRow[];
    normalizeTargetRow(row: Record<string, unknown>, targetColumns: QueryRowColumnMap): Record<string, unknown>;
    normalizeColumnValue(columnType: string | undefined, value: unknown): unknown;
}

export class PassthroughQueryRowNormalizerStrategy implements QueryRowNormalizerStrategy {
    normalizeRootRows<TRow extends Record<string, unknown>>(
        rows: readonly TRow[],
        _columns: QueryRowColumnMap
    ): TRow[] {
        return [...rows];
    }

    normalizeHydratedRowsForParserShape<TRow extends Record<string, unknown>>(
        rows: readonly TRow[],
        _columns: QueryRowColumnMap
    ): TRow[] {
        return [...rows];
    }

    normalizeTargetRow(row: Record<string, unknown>, _targetColumns: QueryRowColumnMap): Record<string, unknown> {
        return row;
    }

    normalizeColumnValue(_columnType: string | undefined, value: unknown): unknown {
        return value;
    }
}

export function createQueryRowNormalizerStrategy(dialect: Dialect): QueryRowNormalizerStrategy {
    return dialect === InternalDialectValue.SQLITE
        ? new SqliteRowNormalizerStrategy()
        : new PassthroughQueryRowNormalizerStrategy();
}

export class SqliteRowNormalizerStrategy implements QueryRowNormalizerStrategy {
    normalizeRootRows<TRow extends Record<string, unknown>>(rows: readonly TRow[], columns: QueryRowColumnMap): TRow[] {
        return this.normalizeRows(rows, columns);
    }

    normalizeHydratedRowsForParserShape<TRow extends Record<string, unknown>>(
        rows: readonly TRow[],
        columns: QueryRowColumnMap
    ): TRow[] {
        return this.normalizeRows(rows, columns);
    }

    normalizeTargetRow(row: Record<string, unknown>, targetColumns: QueryRowColumnMap): Record<string, unknown> {
        return this.normalizeRow(row, this.booleanColumns(targetColumns));
    }

    normalizeColumnValue(columnType: string | undefined, value: unknown): unknown {
        return this.isBooleanColumnType(columnType) ? this.normalizeSqliteBoolean(value) : value;
    }

    private normalizeRows<TRow extends Record<string, unknown>>(
        rows: readonly TRow[],
        columns: QueryRowColumnMap
    ): TRow[] {
        const booleanColumns = this.booleanColumns(columns);
        if (booleanColumns.length === 0) {
            return [...rows];
        }

        return rows.map((row) => this.normalizeRow(row, booleanColumns));
    }

    private normalizeRow<TRow extends Record<string, unknown>>(row: TRow, columns: readonly string[]): TRow {
        let normalized: TRow | null = null;

        for (const column of columns) {
            const current = row[column];
            const next = this.normalizeSqliteBoolean(current);
            if (next === current) {
                continue;
            }
            normalized ??= { ...row };
            (normalized as Record<string, unknown>)[column] = next;
        }

        return normalized ?? row;
    }

    private booleanColumns(columns: QueryRowColumnMap): string[] {
        return Object.entries(columns)
            .filter(([, value]) => this.isBooleanColumnType(value))
            .map(([column]) => column);
    }

    private isBooleanColumnType(value: unknown): boolean {
        return typeof value === 'string' && ['bool', 'boolean'].includes(value.trim().toLowerCase());
    }

    private normalizeSqliteBoolean(value: unknown): unknown {
        if (value === 0 || value === '0') {
            return false;
        }
        if (value === 1 || value === '1') {
            return true;
        }
        return value;
    }
}
