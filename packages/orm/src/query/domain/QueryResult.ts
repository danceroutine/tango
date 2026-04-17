import { getLogger } from '@danceroutine/tango-core';

let didWarnDeprecatedResults = false;

export class QueryResult<T> implements Iterable<T> {
    readonly nextCursor?: string | null;
    private readonly _items: readonly T[];

    constructor(items: readonly T[], options?: { nextCursor?: string | null }) {
        this._items = items;
        this.nextCursor = options?.nextCursor ?? null;
    }

    [Symbol.iterator](): Iterator<T> {
        return this._items[Symbol.iterator]();
    }

    toArray(): T[] {
        return [...this._items];
    }

    toJSON(): { results: readonly T[]; nextCursor?: string | null } {
        return { results: this._items, nextCursor: this.nextCursor };
    }

    /**
     * @deprecated Iterate the `QueryResult` directly or call `toArray()` instead.
     */
    get results(): readonly T[] {
        if (!didWarnDeprecatedResults) {
            didWarnDeprecatedResults = true;
            getLogger('tango.orm.query_result').warn(
                '`QueryResult.results` is deprecated. Iterate the QueryResult directly or call `toArray()` instead.'
            );
        }
        return this._items;
    }
}
