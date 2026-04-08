import type { QuerySet } from '../query/index';
import type { TableMeta } from '../query/domain/index';

/**
 * Public manager contract consumed by Tango resources and applications.
 */
export interface ManagerLike<TModelRow extends Record<string, unknown>, TSourceModel = unknown> {
    readonly meta: TableMeta;
    query(): QuerySet<TModelRow, TModelRow, TSourceModel>;
    findById(id: TModelRow[keyof TModelRow]): Promise<TModelRow | null>;
    getOrThrow(id: TModelRow[keyof TModelRow]): Promise<TModelRow>;
    create(input: Partial<TModelRow>): Promise<TModelRow>;
    update(id: TModelRow[keyof TModelRow], patch: Partial<TModelRow>): Promise<TModelRow>;
    delete(id: TModelRow[keyof TModelRow]): Promise<void>;
    bulkCreate(inputs: Partial<TModelRow>[]): Promise<TModelRow[]>;
}
