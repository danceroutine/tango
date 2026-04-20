import type { QNode } from '../query/domain/QNode';
import type { FilterInput } from '../query/domain/FilterInput';
import type { QuerySet } from '../query/index';
import type { TableMeta } from '../query/domain/index';

/**
 * Public manager contract consumed by Tango resources and applications.
 */
export interface ManagerLike<TModelRow extends Record<string, unknown>, TSourceModel = unknown> {
    readonly meta: TableMeta;
    query(): QuerySet<TModelRow, TModelRow, TSourceModel>;
    all(): QuerySet<TModelRow, TModelRow, TSourceModel>;
    getOrCreate(args: {
        where: FilterInput<TModelRow> | QNode<TModelRow>;
        defaults?: Partial<TModelRow>;
    }): Promise<{ record: TModelRow; created: boolean }>;
    updateOrCreate(args: {
        where: FilterInput<TModelRow> | QNode<TModelRow>;
        defaults?: Partial<TModelRow>;
        update?: Partial<TModelRow>;
    }): Promise<{ record: TModelRow; created: boolean; updated: boolean }>;
    findById(id: TModelRow[keyof TModelRow]): Promise<TModelRow | null>;
    getOrThrow(id: TModelRow[keyof TModelRow]): Promise<TModelRow>;
    create(input: Partial<TModelRow>): Promise<TModelRow>;
    update(id: TModelRow[keyof TModelRow], patch: Partial<TModelRow>): Promise<TModelRow>;
    delete(id: TModelRow[keyof TModelRow]): Promise<void>;
    bulkCreate(inputs: Partial<TModelRow>[]): Promise<TModelRow[]>;
}
