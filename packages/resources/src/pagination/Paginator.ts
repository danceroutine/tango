import type { TangoQueryParams } from '@danceroutine/tango-core';
import type { PaginatedResponse } from './PaginatedResponse';
import type { QueryResult, QuerySet } from '@danceroutine/tango-orm';

export interface Page<T> {
    results: T[];
    hasNext(): boolean;
    hasPrevious(): boolean;
    nextPageNumber(): number | null;
    previousPageNumber(): number | null;
    startIndex(): number;
    endIndex(): number;
}

export interface Paginator<
    TModel extends Record<string, unknown>,
    TResult = TModel,
    TResponse extends PaginatedResponse<TResult> = PaginatedResponse<TResult>,
> {
    parse(params: TangoQueryParams): void;
    apply<TBaseResult extends Record<string, unknown>, TSourceModel, THydrated extends Record<string, unknown>>(
        queryset: QuerySet<TModel, TBaseResult, TSourceModel, THydrated>
    ): QuerySet<TModel, TBaseResult, TSourceModel, THydrated>;
    needsTotalCount(): boolean;
    toResponse(
        results: TResult[] | QueryResult<TResult>,
        context?: { totalCount?: number; params?: TangoQueryParams }
    ): TResponse;
}
