export interface BasePaginatedResponse<T> {
    results: T[];
    next?: string | null;
    previous?: string | null;
}

export interface OffsetPaginatedResponse<T> extends BasePaginatedResponse<T> {
    count?: number;
}

export interface CursorPaginatedResponse<T> extends BasePaginatedResponse<T> {
    count?: never;
}

export type PaginatedResponse<T> = OffsetPaginatedResponse<T> | CursorPaginatedResponse<T>;
