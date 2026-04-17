import { describe, expect, it } from 'vitest';
import { TangoQueryParams } from '../TangoQueryParams';
import { TangoRequest } from '../TangoRequest';

describe(TangoQueryParams, () => {
    it('builds from URLSearchParams and preserves repeated keys', () => {
        const params = TangoQueryParams.fromURLSearchParams(new URLSearchParams('tag=a&tag=b&search=hello'));

        expect(params.get('search')).toBe('hello');
        expect(params.getAll('tag')).toEqual(['a', 'b']);
        expect(params.has('tag')).toBe(true);
    });

    it('builds from record input', () => {
        const params = TangoQueryParams.fromRecord({
            search: ' post ',
            tag: ['one', 'two'],
            empty: [],
            ignored: undefined,
        });

        expect(params.get('search')).toBe(' post ');
        expect(params.getAll('tag')).toEqual(['one', 'two']);
        expect(params.has('empty')).toBe(false);
        expect(params.has('ignored')).toBe(false);
        expect(params.getAll('missing')).toEqual([]);
    });

    it('builds from URLs and requests', () => {
        const fromUrl = TangoQueryParams.fromURL('https://example.test/posts?search=tango&ordering=-createdAt,title');
        expect(fromUrl.getSearch()).toBe('tango');

        const fromUrlObject = TangoQueryParams.fromURL(new URL('https://example.test/posts?ordering=title'));
        expect(fromUrlObject.getOrdering()).toEqual(['title']);

        const request = new Request('https://example.test/posts?tag=orm&tag=http');
        const fromRequest = TangoQueryParams.fromRequest(request);
        expect(fromRequest.getAll('tag')).toEqual(['orm', 'http']);

        const tangoRequest = new TangoRequest('https://example.test/posts?search=query');
        const fromTangoRequest = TangoQueryParams.fromRequest(tangoRequest);
        expect(fromTangoRequest.getSearch()).toBe('query');
    });

    it('trims search values and normalizes ordering tokens', () => {
        const params = TangoQueryParams.fromURLSearchParams(
            new URLSearchParams('search=%20%20tango%20%20&ordering=-createdAt,%20title,,')
        );

        expect(params.getTrimmed('search')).toBe('tango');
        expect(params.getSearch()).toBe('tango');
        expect(params.getOrdering()).toEqual(['-createdAt', 'title']);
    });

    it('converts back to URLSearchParams and identifies matching instances', () => {
        const params = TangoQueryParams.fromRecord({ tag: ['a', 'b'], search: 'orm' });
        const native = params.toURLSearchParams();

        expect(native.getAll('tag')).toEqual(['a', 'b']);
        expect(native.get('search')).toBe('orm');
        expect(Array.from(params.entries())).toEqual([
            ['tag', ['a', 'b']],
            ['search', ['orm']],
        ]);
        expect(Array.from(params.keys())).toEqual(['tag', 'search']);
        expect(TangoQueryParams.isTangoQueryParams(params)).toBe(true);
        expect(TangoQueryParams.isTangoQueryParams({})).toBe(false);
    });

    it('replaces and removes values immutably and renders a relative URL', () => {
        const params = TangoQueryParams.fromRecord({
            search: 'orm',
            limit: '20',
            offset: '0',
        });

        const updated = params.withValues({
            limit: 10,
            offset: 30,
            search: undefined,
            category: ['orm', 'http'],
            tag: [],
        });

        expect(params.toRelativeURL()).toBe('?search=orm&limit=20&offset=0');
        expect(updated.toRelativeURL()).toBe('?limit=10&offset=30&category=orm&category=http');
        expect(TangoQueryParams.fromRecord({}).toRelativeURL()).toBe('');
    });

    it('returns undefined for blank search values and empty ordering inputs', () => {
        const params = TangoQueryParams.fromRecord({
            search: '   ',
            ordering: '',
        });

        expect(params.getTrimmed('search')).toBeUndefined();
        expect(params.getSearch()).toBeUndefined();
        expect(params.getOrdering()).toEqual([]);
    });
});
