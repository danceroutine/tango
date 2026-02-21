import { describe, it, expect } from 'vitest';
import { HttpErrorFactory } from '../HttpErrorFactory';
import { NotFoundError } from '../../';
import { ConflictError } from '../../ConflictError';

describe(HttpErrorFactory, () => {
    it('hides generic Error messages when exposeErrors is false', () => {
        const factory = new HttpErrorFactory({ exposeErrors: false });
        const error = new Error('database connection string leaked');
        const httpError = factory.create(error);

        expect(httpError.status).toBe(500);
        expect(httpError.body.error).toBe('Internal Server Error');
        expect(httpError.body.details).toBeNull();
    });

    it('still shows TangoError messages even when exposeErrors is false', () => {
        const factory = new HttpErrorFactory({ exposeErrors: false });
        const error = new NotFoundError('User not found');
        const httpError = factory.create(error);

        expect(httpError.status).toBe(404);
        expect(httpError.body.error).toBe('User not found');
    });

    it('supports custom error handlers', () => {
        class CustomApiError extends Error {
            constructor(
                message: string,
                public code: string
            ) {
                super(message);
            }
        }

        const factory = new HttpErrorFactory();
        factory.registerHandler(CustomApiError, (err) => ({
            status: 422,
            body: { error: `${err.code}: ${err.message}`, details: null },
        }));

        const httpError = factory.create(new CustomApiError('bad data', 'INVALID'));

        expect(httpError.status).toBe(422);
        expect(httpError.body.error).toBe('INVALID: bad data');
    });

    it('matches handlers by shared class brand for cross-module errors', () => {
        const factory = new HttpErrorFactory().registerHandler(ConflictError, () => ({
            status: 409,
            body: { error: 'conflict', details: null },
        }));

        const crossModuleLikeError = Object.assign(new Error('conflict'), {
            __tangoBrand: ConflictError.BRAND,
        });

        const httpError = factory.create(crossModuleLikeError);
        expect(httpError.status).toBe(409);
        expect(httpError.body.error).toBe('conflict');
    });

    it('matches handlers by constructor name for cross-runtime errors', () => {
        class ExternalApiError extends Error {}

        const factory = new HttpErrorFactory().registerHandler(ExternalApiError, () => ({
            status: 418,
            body: { error: 'teapot', details: null },
        }));

        const crossRuntimeError = new Error('runtime');
        Object.defineProperty(crossRuntimeError, 'constructor', {
            value: { name: 'ExternalApiError' },
            configurable: true,
        });

        const httpError = factory.create(crossRuntimeError);
        expect(httpError.status).toBe(418);
        expect(httpError.body.error).toBe('teapot');
    });

    it('matches handlers by error.name fallback when constructor name differs', () => {
        class NameOnlyError extends Error {}

        const factory = new HttpErrorFactory().registerHandler(NameOnlyError, () => ({
            status: 451,
            body: { error: 'unavailable', details: null },
        }));

        const namedError = new Error('named');
        namedError.name = 'NameOnlyError';

        const httpError = factory.create(namedError);
        expect(httpError.status).toBe(451);
        expect(httpError.body.error).toBe('unavailable');
    });

    it('registerHandler returns this for chaining', () => {
        const factory = new HttpErrorFactory();
        const result = factory.registerHandler(TypeError, () => ({
            status: 400,
            body: { error: 'Type error', details: null },
        }));

        expect(result).toBe(factory);
    });

    it('ignores values that do not match a registered error class', () => {
        class KnownError extends Error {}

        const factory = new HttpErrorFactory().registerHandler(KnownError, () => ({
            status: 499,
            body: { error: 'known', details: null },
        }));

        const primitive = factory.create(123);
        expect(primitive.status).toBe(500);
        expect(primitive.body.error).toBe('Unknown error occurred');

        const unknownObject = factory.create({ message: 'not an error instance' });
        expect(unknownObject.status).toBe(500);
        expect(unknownObject.body.error).toBe('Unknown error occurred');

        const unmatchedError = factory.create(new Error('unknown'));
        expect(unmatchedError.status).toBe(500);
        expect(unmatchedError.body.error).toBe('unknown');
    });
});
