import type { TangoRequest } from './TangoRequest';

type QueryParamRecord = Record<string, string | string[] | undefined>;

/**
 * Immutable query parameter helper that normalizes framework-specific shapes
 * into one Tango-owned API.
 */
export class TangoQueryParams {
    static readonly BRAND = 'tango.http.query_params' as const;
    readonly __tangoBrand: typeof TangoQueryParams.BRAND = TangoQueryParams.BRAND;
    private readonly values: Map<string, readonly string[]>;

    private constructor(values: Map<string, readonly string[]>) {
        this.values = values;
    }

    /**
     * Narrow an unknown value to `TangoQueryParams`.
     */
    static isTangoQueryParams(value: unknown): value is TangoQueryParams {
        return (
            typeof value === 'object' &&
            value !== null &&
            (value as { __tangoBrand?: unknown }).__tangoBrand === TangoQueryParams.BRAND
        );
    }

    /**
     * Build query params from a `URLSearchParams` instance.
     */
    static fromURLSearchParams(params: URLSearchParams): TangoQueryParams {
        const values = new Map<string, string[]>();

        for (const [key, value] of params.entries()) {
            const current = values.get(key);
            if (current) {
                current.push(value);
                continue;
            }
            values.set(key, [value]);
        }

        return new TangoQueryParams(values);
    }

    /**
     * Build query params from framework record-style search params.
     */
    static fromRecord(params: QueryParamRecord): TangoQueryParams {
        const values = new Map<string, string[]>();

        for (const [key, value] of Object.entries(params)) {
            if (Array.isArray(value)) {
                const normalized = value.filter((entry) => typeof entry === 'string');
                if (normalized.length > 0) {
                    values.set(key, normalized);
                }
                continue;
            }

            if (typeof value === 'string') {
                values.set(key, [value]);
            }
        }

        return new TangoQueryParams(values);
    }

    /**
     * Build query params from a full URL string or URL object.
     */
    static fromURL(input: string | URL): TangoQueryParams {
        const url = typeof input === 'string' ? new URL(input) : input;
        return TangoQueryParams.fromURLSearchParams(url.searchParams);
    }

    /**
     * Build query params from a request-like object with a URL.
     */
    static fromRequest(request: Request | TangoRequest): TangoQueryParams {
        return TangoQueryParams.fromURL(request.url);
    }

    /**
     * Get the first value for a query param.
     */
    get(name: string): string | undefined {
        return this.values.get(name)?.[0];
    }

    /**
     * Get all values for a query param.
     */
    getAll(name: string): string[] {
        return [...(this.values.get(name) ?? [])];
    }

    /**
     * Check whether a query param exists.
     */
    has(name: string): boolean {
        return (this.values.get(name)?.length ?? 0) > 0;
    }

    /**
     * Iterate key -> values entries.
     */
    *entries(): IterableIterator<[string, string[]]> {
        for (const [key, values] of this.values.entries()) {
            yield [key, [...values]];
        }
    }

    /**
     * Iterate keys present in the query params.
     */
    *keys(): IterableIterator<string> {
        yield* this.values.keys();
    }

    /**
     * Convert back to a native `URLSearchParams` object.
     */
    toURLSearchParams(): URLSearchParams {
        const params = new URLSearchParams();

        for (const [key, values] of this.values.entries()) {
            for (const value of values) {
                params.append(key, value);
            }
        }

        return params;
    }

    /**
     * Get a trimmed value, omitting blank strings.
     */
    getTrimmed(name: string): string | undefined {
        const value = this.get(name)?.trim();
        return value ? value : undefined;
    }

    /**
     * Get the free-text search param using Tango's default key.
     */
    getSearch(key: string = 'search'): string | undefined {
        return this.getTrimmed(key);
    }

    /**
     * Get the ordering param as trimmed field tokens.
     */
    getOrdering(key: string = 'ordering'): string[] {
        const value = this.get(key);
        if (!value) {
            return [];
        }

        return value
            .split(',')
            .map((token) => token.trim())
            .filter((token) => token.length > 0);
    }
}
