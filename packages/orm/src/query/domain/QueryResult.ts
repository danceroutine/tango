export interface QueryResult<T> {
    results: T[];
    nextCursor?: string | null;
}
