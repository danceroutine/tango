import { describe, expect, it } from 'vitest';
import { RequestContext } from '@danceroutine/tango-resources/context';
import { aRequestContext } from '../aRequestContext';

describe(aRequestContext, () => {
    it('creates a default request context', () => {
        const context = aRequestContext('GET', 'https://example.test/');

        expect(context.request.method).toBe('GET');
        expect(context.request.url).toBe('https://example.test/');
        expect(context.user).toBeNull();
        expect(context.params).toEqual({});
    });

    it('applies body, params, user, and custom headers', async () => {
        const context = aRequestContext<{ id: number }>({
            method: 'POST',
            url: 'https://example.test/users',
            body: { name: 'Pedro' },
            user: { id: 1 },
            params: { id: '1' },
            headers: { 'x-trace-id': 'trace-1' },
        });

        expect(context.request.method).toBe('POST');
        expect(context.params).toEqual({ id: '1' });
        expect(context.user).toEqual({ id: 1 });
        expect(context.request.headers.get('content-type')).toBe('application/json');
        expect(context.request.headers.get('x-trace-id')).toBe('trace-1');
        await expect(context.request.json()).resolves.toEqual({ name: 'Pedro' });
    });

    it('supports positional method/url/body parameters', async () => {
        const context = aRequestContext('PATCH', 'https://example.test/users/1', { name: 'Patched' });
        expect(context.request.method).toBe('PATCH');
        await expect(context.request.json()).resolves.toEqual({ name: 'Patched' });
    });

    it('supports caller-provided context factories for nominally local RequestContext types', () => {
        const context = aRequestContext({
            method: 'GET',
            url: 'https://example.test/local',
            contextFactory: RequestContext.create,
        });

        expect(context).toBeInstanceOf(RequestContext);
        expect(context.request.url).toBe('https://example.test/local');
    });
});
