import { vi } from 'vitest';
import type { Request } from 'express';

type ExpressRequestParams = Request['params'] | Record<string, string | string[]>;

/**
 * Overrides accepted by `anExpressRequest`. All fields are optional;
 * sensible defaults are provided for a minimal GET request.
 */
export type ExpressRequestOverrides = {
    protocol?: string;
    method?: string;
    originalUrl?: string;
    url?: string;
    // oxlint-disable-next-line typescript/no-explicit-any
    headers?: Record<string, any>;
    // oxlint-disable-next-line typescript/no-explicit-any
    body?: any;
    params?: ExpressRequestParams;
    get?: (name: string) => string | undefined;
};

/**
 * Create a minimal Express `Request` test double.
 * The `get` method is a Vitest mock that returns `'localhost:3000'` for the
 * `host` header and `undefined` for everything else, matching the most common
 * test pattern. Override any field via the `overrides` argument.
 */
export function anExpressRequest(overrides: ExpressRequestOverrides = {}): Request {
    return {
        protocol: 'http',
        method: 'GET',
        originalUrl: '/',
        url: '/',
        headers: {},
        body: undefined,
        params: {},
        get: vi.fn((name: string) => (name.toLowerCase() === 'host' ? 'localhost:3000' : undefined)),
        ...overrides,
    } as unknown as Request;
}
