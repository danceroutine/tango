import { getLogger } from '@danceroutine/tango-core';

let didWarnDeprecatedResults = false;

export class QueryResult<T> implements Iterable<T> {
    readonly nextCursor?: string | null;
    readonly items: readonly T[];

    constructor(items: readonly T[], options?: { nextCursor?: string | null }) {
        Object.defineProperty(this, 'items', {
            value: items,
            enumerable: false,
            writable: false,
            configurable: false,
        });
        this.nextCursor = options?.nextCursor ?? null;
    }

    [Symbol.iterator](): Iterator<T> {
        return this.items[Symbol.iterator]();
    }

    toArray(): T[] {
        return [...this.items];
    }

    toJSON(): { results: readonly T[]; nextCursor?: string | null } {
        return { results: this.items, nextCursor: this.nextCursor };
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
        return this.items;
    }
}
