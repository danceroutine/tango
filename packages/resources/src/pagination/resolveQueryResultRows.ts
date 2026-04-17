import { QueryResult } from '@danceroutine/tango-orm';

export function resolveQueryResultRows<T>(rows: readonly T[] | QueryResult<T>): T[] {
    if (rows instanceof QueryResult) {
        return rows.toArray();
    }
    return rows as T[];
}
