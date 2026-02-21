import { describe, expect, it, vi } from 'vitest';
import { anExpressResponse } from '../anExpressResponse';

describe(anExpressResponse, () => {
    it('creates chainable express response mocks', () => {
        const response = anExpressResponse();

        expect(response.status(201)).toBe(response);
        expect(response.sendStatus(204)).toBe(response);
        expect(response.links({ next: '/next' })).toBe(response);
        expect(response.contentType('application/json')).toBe(response);
        expect(response.type('json')).toBe(response);
        expect(response.format({})).toBe(response);
        expect(response.attachment('report.csv')).toBe(response);
        expect(response.set('x-test', '1')).toBe(response);
        expect(response.header('x-test', '1')).toBe(response);
        expect(response.clearCookie('token')).toBe(response);
        expect(response.cookie('token', 'abc')).toBe(response);
        expect(response.location('/next')).toBe(response);
        expect(response.vary('accept')).toBe(response);
        expect(response.append('set-cookie', 'a=1')).toBe(response);
        expect(response.setHeader('x-test', '1')).toBe(response);
    });

    it('creates non-chainable express response mocks and default mutable fields', () => {
        const response = anExpressResponse();

        expect(response.send('ok')).toBe(response);
        expect(response.json({ ok: true })).toBe(response);
        expect(response.jsonp({ ok: true })).toBe(response);
        expect(response.end()).toBe(response);
        response.sendFile('/tmp/file');
        response.download('/tmp/file');
        response.redirect('/next');
        response.render('view');
        response.get('x-test');

        expect(vi.mocked(response.sendFile)).toHaveBeenCalledWith('/tmp/file');
        expect(vi.mocked(response.download)).toHaveBeenCalledWith('/tmp/file');
        expect(vi.mocked(response.redirect)).toHaveBeenCalledWith('/next');
        expect(vi.mocked(response.render)).toHaveBeenCalledWith('view');
        expect(vi.mocked(response.get)).toHaveBeenCalledWith('x-test');
        expect(response.headersSent).toBe(false);
        expect(response.locals).toEqual({});
        expect(response.charset).toBe('utf-8');
        expect(response.app).toEqual({});
        expect(response.req).toEqual({});
    });
});
