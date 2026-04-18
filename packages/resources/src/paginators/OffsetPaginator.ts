import { TangoQueryParams } from '@danceroutine/tango-core';
import type { QueryResult, QuerySet } from '@danceroutine/tango-orm';
import { BasePaginator } from '../pagination/BasePaginator';
import type { Paginator, Page } from '../pagination/Paginator';
import type { OffsetPaginatedResponse } from '../pagination/PaginatedResponse';
import { OffsetPaginationInput } from '../pagination/OffsetPaginationInput';

class OffsetPage<T> implements Page<T> {
    static readonly BRAND = 'tango.resources.offset_page' as const;
    readonly __tangoBrand: typeof OffsetPage.BRAND = OffsetPage.BRAND;

    constructor(
        public readonly results: T[],
        private readonly pageNumber: number,
        private readonly perPage: number,
        private readonly totalCount?: number
    ) {}

    static isOffsetPage<T>(value: unknown): value is OffsetPage<T> {
        return (
            typeof value === 'object' &&
            value !== null &&
            (value as { __tangoBrand?: unknown }).__tangoBrand === OffsetPage.BRAND
        );
    }

    /** Whether a next page exists based on known total count. */
    hasNext(): boolean {
        if (this.totalCount === undefined) {
            return false;
        }
        return this.endIndex() < this.totalCount;
    }

    /** Whether a previous page exists. */
    hasPrevious(): boolean {
        return this.pageNumber > 1;
    }

    /** The next page number, if available. */
    nextPageNumber(): number | null {
        return this.hasNext() ? this.pageNumber + 1 : null;
    }

    /** The previous page number, if available. */
    previousPageNumber(): number | null {
        return this.hasPrevious() ? this.pageNumber - 1 : null;
    }

    /** Zero-based start index of this page in the full result set. */
    startIndex(): number {
        return (this.pageNumber - 1) * this.perPage;
    }

    /** Exclusive end index of this page in the full result set. */
    endIndex(): number {
        return this.startIndex() + this.results.length;
    }
}

/**
 * Offset/limit paginator modelled after DRF's LimitOffsetPagination.
 * Handles parsing limit/offset/page from URL query params and building
 * the paginated response envelope with next/previous links.
 *
 * @example
 * ```typescript
 * const paginator = new OffsetPaginator(queryset);
 * const { limit, offset } = paginator.parseParams(searchParams);
 * const results = await queryset.limit(limit).offset(offset).fetchAll();
 * const response = paginator.getPaginatedResponse(results, totalCount);
 * ```
 */
export class OffsetPaginator<T extends Record<string, unknown>>
    extends BasePaginator
    implements Paginator<T, T, OffsetPaginatedResponse<T>>
{
    static readonly BRAND = 'tango.resources.offset_paginator' as const;
    readonly __tangoBrand: typeof OffsetPaginator.BRAND = OffsetPaginator.BRAND;
    private limit = 25;
    private offset = 0;

    constructor(
        private queryset: QuerySet<T>,
        private perPage: number = 25
    ) {
        super();
        this.limit = perPage;
    }

    /**
     * Narrow an unknown value to `OffsetPaginator`.
     */
    static isOffsetPaginator<T extends Record<string, unknown>>(value: unknown): value is OffsetPaginator<T> {
        return (
            typeof value === 'object' &&
            value !== null &&
            (value as { __tangoBrand?: unknown }).__tangoBrand === OffsetPaginator.BRAND
        );
    }

    /**
     * Parse limit, offset, and page from Tango query params.
     * If `page` is provided, it's converted to an offset.
     * Stores parsed values for use by getPaginatedResponse.
     */
    parse(params: TangoQueryParams): void {
        const input = {
            limit: params.get('limit') ?? undefined,
            offset: params.get('offset') ?? undefined,
            page: params.get('page') ?? undefined,
        };

        const parsed = OffsetPaginationInput.parse(input);

        if (parsed.page) {
            parsed.offset = (parsed.page - 1) * parsed.limit;
        }

        this.limit = parsed.limit;
        this.offset = parsed.offset;
    }

    /**
     * Parse params and return `{ limit, offset }` for compatibility callers.
     */
    parseParams(params: TangoQueryParams): { limit: number; offset: number } {
        this.parse(params);
        return { limit: this.limit, offset: this.offset };
    }

    /**
     * Build a DRF-style paginated response with count, next, and previous links.
     * Uses the limit/offset stored from the most recent parseParams call.
     */
    needsTotalCount(): boolean {
        return true;
    }

    toResponse<TResult>(
        results: readonly TResult[] | QueryResult<TResult>,
        context?: { totalCount?: number; params?: TangoQueryParams }
    ): OffsetPaginatedResponse<TResult> {
        const totalCount = context?.totalCount;
        const response: OffsetPaginatedResponse<TResult> = { results: this.resolveQueryResultRows(results) };

        if (totalCount !== undefined) {
            response.count = totalCount;

            if (this.offset + this.limit < totalCount) {
                response.next = this.buildPageLink(this.offset + this.limit, context?.params);
            }

            if (this.offset > 0) {
                const prevOffset = Math.max(0, this.offset - this.limit);
                response.previous = this.buildPageLink(prevOffset, context?.params);
            }
        }

        return response;
    }

    /**
     * Backward-compatible alias for `toResponse`.
     */
    getPaginatedResponse<TResult>(
        results: readonly TResult[] | QueryResult<TResult>,
        totalCount?: number,
        params?: TangoQueryParams
    ): OffsetPaginatedResponse<TResult> {
        return this.toResponse(results, { totalCount, params });
    }

    /**
     * Apply current limit/offset to a queryset.
     */
    apply<TBaseResult extends Record<string, unknown>, TSourceModel, THydrated extends Record<string, unknown>>(
        queryset: QuerySet<T, TBaseResult, TSourceModel, THydrated>
    ): QuerySet<T, TBaseResult, TSourceModel, THydrated> {
        return queryset.limit(this.limit).offset(this.offset);
    }

    /**
     * Fetch a 1-based page number from the bound queryset.
     */
    async paginate(page: number): Promise<Page<T>> {
        return this.getPage(page);
    }

    /**
     * Fetch a 1-based page and return page metadata.
     */
    async getPage(page: number): Promise<Page<T>> {
        const offset = (page - 1) * this.perPage;
        const results = await this.queryset.offset(offset).limit(this.perPage).fetch();

        const totalCount = await this.count();

        return new OffsetPage(this.resolveQueryResultRows(results), page, this.perPage, totalCount);
    }

    /**
     * Count total rows for the current queryset state.
     */
    async count(): Promise<number> {
        return this.queryset.count();
    }

    private buildPageLink(offset: number, params?: TangoQueryParams): string {
        if (!params) {
            return `?limit=${this.limit}&offset=${offset}`;
        }

        return params
            .withValues({
                limit: this.limit,
                offset,
                page: null,
            })
            .toRelativeURL();
    }
}
