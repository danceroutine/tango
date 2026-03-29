import type { TangoQueryParams } from '@danceroutine/tango-core';
import type { PaginatedResponse } from './PaginatedResponse';
import type { QuerySet } from '@danceroutine/tango-orm';

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
    apply(queryset: QuerySet<TModel>): QuerySet<TModel>;
    needsTotalCount(): boolean;
    toResponse(results: TResult[], context?: { totalCount?: number }): TResponse;
}
