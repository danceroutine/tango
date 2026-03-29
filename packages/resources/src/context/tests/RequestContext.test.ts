import { describe, expect, it } from 'vitest';
import { TangoRequest } from '@danceroutine/tango-core';
import { RequestContext } from '../RequestContext';

describe(RequestContext, () => {
    it('starts with empty user and params by default', () => {
        const request = new TangoRequest('https://example.test');
        const ctx = new RequestContext(request);

        expect(ctx.request).toBe(request);
        expect(ctx.user).toBeNull();
        expect(ctx.params).toEqual({});
    });

    it('stores and reads state entries', () => {
        const ctx = RequestContext.create(new Request('https://example.test'));
        const key = Symbol('state-key');
        ctx.setState(key, { role: 'admin' });

        expect(ctx.hasState(key)).toBe(true);
        expect(ctx.getState<{ role: string }>(key)).toEqual({ role: 'admin' });
        expect(ctx.getState('missing')).toBeUndefined();
    });

    it('clones params and state', () => {
        const request = new TangoRequest('https://example.test');
        const ctx = RequestContext.create(request, { id: 1 });
        ctx.params = { id: '42' };
        ctx.setState('k', 'v');

        const cloned = ctx.clone();
        expect(cloned).not.toBe(ctx);
        expect(cloned.request).toBe(request);
        expect(cloned.user).toEqual({ id: 1 });
        expect(cloned.params).toEqual({ id: '42' });
        expect(cloned.getState('k')).toBe('v');

        cloned.params.id = '7';
        expect(ctx.params.id).toBe('42');
    });

    it('identifies request context instances', () => {
        const ctx = RequestContext.create(new Request('https://example.test'));
        expect(RequestContext.isRequestContext(ctx)).toBe(true);
        expect(RequestContext.isRequestContext({})).toBe(false);
    });

    it('normalizes plain requests into TangoRequest instances', () => {
        const ctx = RequestContext.create(new Request('https://example.test/posts?search=tango'));
        expect(TangoRequest.isTangoRequest(ctx.request)).toBe(true);
        expect(ctx.request.queryParams.getSearch()).toBe('tango');
    });
});
