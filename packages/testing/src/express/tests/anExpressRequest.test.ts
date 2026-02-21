import { describe, expect, it, vi } from 'vitest';
import { anExpressRequest } from '../anExpressRequest';

describe(anExpressRequest, () => {
    it('creates a minimal GET request with a host lookup mock', () => {
        const request = anExpressRequest();

        expect(request.protocol).toBe('http');
        expect(request.method).toBe('GET');
        expect(request.originalUrl).toBe('/');
        expect(request.url).toBe('/');
        expect(request.params).toEqual({});
        expect(request.get('host')).toBe('localhost:3000');
        expect(request.get('x-forwarded-host')).toBeUndefined();
        expect(vi.mocked(request.get)).toHaveBeenCalledTimes(2);
    });

    it('applies caller overrides', () => {
        const get = vi.fn(() => 'example.test');
        const request = anExpressRequest({
            protocol: 'https',
            method: 'POST',
            originalUrl: '/users',
            url: '/users',
            headers: { 'content-type': 'application/json' },
            body: { email: 'test@example.com' },
            params: { id: '123' },
            get,
        });

        expect(request.protocol).toBe('https');
        expect(request.method).toBe('POST');
        expect(request.headers).toEqual({ 'content-type': 'application/json' });
        expect(request.body).toEqual({ email: 'test@example.com' });
        expect(request.params).toEqual({ id: '123' });
        expect(request.get('host')).toBe('example.test');
    });
});
