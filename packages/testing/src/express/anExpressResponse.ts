import { vi } from 'vitest';
import type { Response } from 'express';

/**
 * Create an Express `Response` test double.
 *
 * Every Express `Response` method is backed by a `vi.fn()`.
 * Chainable methods (`status`, `sendStatus`, `links`, etc.) return `res`.
 * Use `vi.mocked()` to access the mock API for assertions.
 */
export function anExpressResponse(): Response {
    const res: Record<string, unknown> = {};

    const chainable = [
        'status',
        'sendStatus',
        'links',
        'contentType',
        'type',
        'format',
        'attachment',
        'set',
        'header',
        'clearCookie',
        'cookie',
        'location',
        'vary',
        'append',
    ];

    for (const method of chainable) {
        res[method] = vi.fn().mockReturnValue(res);
    }

    res.send = vi.fn().mockReturnValue(res);
    res.json = vi.fn().mockReturnValue(res);
    res.jsonp = vi.fn().mockReturnValue(res);
    res.end = vi.fn().mockReturnValue(res);
    res.sendFile = vi.fn();
    res.download = vi.fn();
    res.redirect = vi.fn();
    res.render = vi.fn();
    res.get = vi.fn();
    res.setHeader = vi.fn().mockReturnValue(res);

    res.headersSent = false;
    res.locals = {};
    res.charset = 'utf-8';
    res.app = {};
    res.req = {};

    return res as unknown as Response;
}
