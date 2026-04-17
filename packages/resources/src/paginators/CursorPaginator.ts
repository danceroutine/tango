import { TangoQueryParams } from '@danceroutine/tango-core';
import type { FilterInput, QueryResult, QuerySet } from '@danceroutine/tango-orm';
import { resolveQueryResultRows } from '../pagination/resolveQueryResultRows';
import type { Paginator, Page } from '../pagination/Paginator';
import type { CursorPaginatedResponse } from '../pagination/PaginatedResponse';
import { CursorPaginationInput } from '../pagination/CursorPaginationInput';

type CursorDirection = 'asc' | 'desc';

type CursorPayload = {
    v: 1;
    field: string;
    dir: CursorDirection;
    value: unknown;
};

/**
 * Represents a single cursor page of results.
 * Cursor pages do not expose numeric page navigation like offset pagination.
 */
class CursorPage<T> implements Page<T> {
    static readonly BRAND = 'tango.resources.cursor_page' as const;
    readonly __tangoBrand: typeof CursorPage.BRAND = CursorPage.BRAND;

    constructor(
        public readonly results: T[],
        public readonly nextCursor: string | null,
        public readonly previousCursor: string | null
    ) {}

    static isCursorPage<T>(value: unknown): value is CursorPage<T> {
        return (
            typeof value === 'object' &&
            value !== null &&
            (value as { __tangoBrand?: unknown }).__tangoBrand === CursorPage.BRAND
        );
    }

    /** Whether a next cursor token exists. */
    hasNext(): boolean {
        return this.nextCursor !== null;
    }

    /** Whether a previous cursor token exists. */
    hasPrevious(): boolean {
        return this.previousCursor !== null;
    }

    nextPageNumber(): number | null {
        return null;
    }

    previousPageNumber(): number | null {
        return null;
    }

    startIndex(): number {
        return 0;
    }

    endIndex(): number {
        return this.results.length;
    }
}

/**
 * Cursor-based paginator for stable forward navigation with opaque cursor tokens.
 * It supports `limit`, `cursor`, and `ordering` query params and returns DRF-style
 * paginated envelopes with cursor links.
 */
export class CursorPaginator<T extends Record<string, unknown>> implements Paginator<T, T, CursorPaginatedResponse<T>> {
    static readonly BRAND = 'tango.resources.cursor_paginator' as const;
    readonly __tangoBrand: typeof CursorPaginator.BRAND = CursorPaginator.BRAND;
    private limit: number;
    private cursor: string | null = null;
    private direction: CursorDirection = 'asc';
    private nextCursor: string | null = null;
    private previousCursor: string | null = null;

    constructor(
        private queryset: QuerySet<T>,
        private perPage: number = 25,
        private cursorField: keyof T = 'id' as keyof T
    ) {
        this.limit = perPage;
    }

    /**
     * Narrow an unknown value to `CursorPaginator`.
     */
    static isCursorPaginator<T extends Record<string, unknown>>(value: unknown): value is CursorPaginator<T> {
        return (
            typeof value === 'object' &&
            value !== null &&
            (value as { __tangoBrand?: unknown }).__tangoBrand === CursorPaginator.BRAND
        );
    }

    /**
     * Parse cursor pagination parameters from Tango query params.
     */
    parse(params: TangoQueryParams): void {
        const parsed = CursorPaginationInput.parse({
            limit: params.get('limit') ?? undefined,
            cursor: params.get('cursor'),
            ordering: params.get('ordering') ?? undefined,
        });

        this.limit = parsed.limit ?? this.perPage;
        this.cursor = parsed.cursor;

        const ordering = parsed.ordering;
        if (ordering) {
            const parsedDirection: CursorDirection = ordering.startsWith('-') ? 'desc' : 'asc';
            const parsedField = ordering.startsWith('-') ? ordering.slice(1) : ordering;
            this.direction = parsedField === String(this.cursorField) ? parsedDirection : 'asc';
        } else {
            this.direction = 'asc';
        }
    }

    /**
     * Parse params and return compatibility `{ limit, offset }` shape.
     */
    parseParams(params: TangoQueryParams): { limit: number; offset: number } {
        this.parse(params);
        return { limit: this.limit, offset: 0 };
    }

    /**
     * Build a paginated response payload with cursor links.
     */
    needsTotalCount(): boolean {
        return false;
    }

    toResponse<TResult>(
        results: TResult[] | QueryResult<TResult>,
        _context?: { totalCount?: number; params?: TangoQueryParams }
    ): CursorPaginatedResponse<TResult> {
        const response: CursorPaginatedResponse<TResult> = { results: resolveQueryResultRows(results) };
        if (this.nextCursor) {
            response.next = this.buildPageLink(this.nextCursor);
        }
        if (this.previousCursor) {
            response.previous = this.buildPageLink(this.previousCursor);
        }
        return response;
    }

    /**
     * Backward-compatible alias for `toResponse`.
     */
    getPaginatedResponse<TResult>(
        results: TResult[] | QueryResult<TResult>,
        _totalCount?: number
    ): CursorPaginatedResponse<TResult> {
        return this.toResponse(results);
    }

    /**
     * Apply cursor constraints and ordering to a queryset.
     */
    apply<TBaseResult extends Record<string, unknown>, TSourceModel, THydrated extends Record<string, unknown>>(
        queryset: QuerySet<T, TBaseResult, TSourceModel, THydrated>
    ): QuerySet<T, TBaseResult, TSourceModel, THydrated> {
        let qs = queryset.limit(this.limit + 1);
        if (this.cursor) {
            const decoded = this.decodeCursor(this.cursor);
            if (decoded.field !== String(this.cursorField)) {
                throw new Error('Invalid cursor: field mismatch');
            }
            const lookup = this.direction === 'asc' ? '__gt' : '__lt';
            const fieldLookup = `${String(this.cursorField)}${lookup}`;
            const filterInput = { [fieldLookup]: decoded.value } as FilterInput<T>;
            qs = qs.filter(filterInput);
        }
        const orderToken = this.direction === 'asc' ? String(this.cursorField) : `-${String(this.cursorField)}`;
        return qs.orderBy(orderToken as keyof T | `-${string}`);
    }

    /**
     * Fetch the next cursor page.
     */
    async paginate(cursor?: string): Promise<Page<T>> {
        const appliedCursor = cursor ?? this.cursor;
        this.cursor = appliedCursor;
        const fetched = await this.apply(this.queryset).fetch();
        const results = resolveQueryResultRows(fetched);
        const hasMore = results.length > this.limit;

        if (hasMore) {
            results.pop();
        }

        this.previousCursor = appliedCursor ?? null;
        const last = results.at(-1);
        this.nextCursor = hasMore && last ? this.encodeCursor(last) : null;

        return new CursorPage(results, this.nextCursor, this.previousCursor);
    }

    /**
     * Cursor paginators only support page `1` as an entry point.
     */
    async getPage(page: number): Promise<Page<T>> {
        if (page !== 1) {
            throw new Error('CursorPaginator only supports getPage(1). Use cursor pagination for subsequent pages.');
        }
        return this.paginate();
    }

    private buildPageLink(cursor: string): string {
        const orderingToken = this.direction === 'asc' ? String(this.cursorField) : `-${String(this.cursorField)}`;
        return `?limit=${this.limit}&cursor=${encodeURIComponent(cursor)}&ordering=${encodeURIComponent(orderingToken)}`;
    }

    private encodeCursor(item: T): string {
        const payload: CursorPayload = {
            v: 1,
            field: String(this.cursorField),
            dir: this.direction,
            value: item[this.cursorField],
        };
        return Buffer.from(JSON.stringify(payload), 'utf-8').toString('base64');
    }

    private decodeCursor(cursor: string): CursorPayload {
        let parsed: unknown;
        try {
            parsed = JSON.parse(Buffer.from(cursor, 'base64').toString('utf-8'));
        } catch {
            throw new Error('Invalid cursor: malformed token');
        }

        if (
            !parsed ||
            typeof parsed !== 'object' ||
            (parsed as { v?: unknown }).v !== 1 ||
            typeof (parsed as { field?: unknown }).field !== 'string' ||
            ((parsed as { dir?: unknown }).dir !== 'asc' && (parsed as { dir?: unknown }).dir !== 'desc') ||
            !('value' in parsed)
        ) {
            throw new Error('Invalid cursor: unsupported payload');
        }

        return parsed as CursorPayload;
    }
}
