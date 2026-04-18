import { QueryResult } from '@danceroutine/tango-orm';

export abstract class BasePaginator {
    protected resolveQueryResultRows<T>(rows: readonly T[] | QueryResult<T>): T[] {
        if (QueryResult.isQueryResult<T>(rows)) {
            return rows.toArray();
        }
        return [...rows];
    }
}
