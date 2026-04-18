import { getLogger } from '@danceroutine/tango-core';

let didWarnDeprecatedResults = false;

/**
 * Materialized rows returned by `QuerySet.fetch()`, including optional cursor metadata for pagination flows.
 */
export class QueryResult<T> implements Iterable<T> {
    static readonly BRAND = 'tango.orm.query_result' as const;
    readonly __tangoBrand: typeof QueryResult.BRAND = QueryResult.BRAND;

    readonly nextCursor?: string | null;
    readonly items: readonly T[];

    constructor(items: readonly T[], options?: { nextCursor?: string | null }) {
        this.items = items;
        this.nextCursor = options?.nextCursor ?? null;
    }

    /**
     * Runtime narrowing for values that may be a plain array or a `QueryResult` instance.
     */
    static isQueryResult<T>(value: unknown): value is QueryResult<T> {
        return (
            typeof value === 'object' &&
            value !== null &&
            (value as { __tangoBrand?: unknown }).__tangoBrand === QueryResult.BRAND
        );
    }

    /**
     * Sync iteration over materialized rows.
     */
    [Symbol.iterator](): Iterator<T> {
        return this.items[Symbol.iterator]();
    }

    /** Number of materialized rows. */
    get length(): number {
        return this.items.length;
    }

    /** Same as `Array#map` on the materialized rows. */
    map<U>(callbackfn: (value: T, index: number, array: readonly T[]) => U, thisArg?: unknown): U[] {
        return this.items.map(callbackfn, thisArg);
    }

    /** Indexed read with support for negative indices, like `Array#at`. */
    at(index: number): T | undefined {
        return this.items.at(index);
    }

    /** Returns a shallow copy of the materialized rows as a plain array. */
    toArray(): T[] {
        return [...this.items];
    }

    /** Serialization shape aligned with historical `{ results, nextCursor }` envelopes. */
    toJSON(): { results: readonly T[]; nextCursor?: string | null } {
        return { results: this.items, nextCursor: this.nextCursor };
    }

    /**
     * @deprecated Use iteration, `length`, `map`, or `toArray()` instead.
     */
    get results(): readonly T[] {
        if (!didWarnDeprecatedResults) {
            didWarnDeprecatedResults = true;
            getLogger('tango.orm.query_result').warn(
                '`QueryResult.results` is deprecated. Use iteration, `length`, `map`, or `toArray()` instead.'
            );
        }
        return this.items;
    }
}
