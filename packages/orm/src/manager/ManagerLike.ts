import type { QuerySet } from '../query/index';
import type { TableMeta } from '../query/domain/index';

/**
 * Public manager contract consumed by Tango resources and applications.
 */
export interface ManagerLike<T extends Record<string, unknown>> {
    readonly meta: TableMeta;
    query(): QuerySet<T>;
    findById(id: T[keyof T]): Promise<T | null>;
    getOrThrow(id: T[keyof T]): Promise<T>;
    create(input: Partial<T>): Promise<T>;
    update(id: T[keyof T], patch: Partial<T>): Promise<T>;
    delete(id: T[keyof T]): Promise<void>;
    bulkCreate(inputs: Partial<T>[]): Promise<T[]>;
}
