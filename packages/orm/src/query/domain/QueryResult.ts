import { getLogger } from '@danceroutine/tango-core';

let didWarnDeprecatedResults = false;

export class QueryResult<T> implements Iterable<T> {
    readonly nextCursor?: string | null;
    readonly items: readonly T[];

    constructor(items: readonly T[], options?: { nextCursor?: string | null }) {
        this.items = items;
        this.nextCursor = options?.nextCursor ?? null;
    }

    [Symbol.iterator](): Iterator<T> {
        return this.items[Symbol.iterator]();
    }

    get length(): number {
        return this.items.length;
    }

    map<U>(callbackfn: (value: T, index: number, array: readonly T[]) => U, thisArg?: unknown): U[] {
        return this.items.map(callbackfn, thisArg);
    }

    at(index: number): T | undefined {
        return this.items.at(index);
    }

    toArray(): T[] {
        return [...this.items];
    }

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
