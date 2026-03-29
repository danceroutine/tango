import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { TangoError } from '../TangoError';
import { AuthenticationError } from '../AuthenticationError';
import { ConflictError } from '../ConflictError';
import { NotFoundError } from '../NotFoundError';
import { PermissionDenied } from '../PermissionDenied';
import { ValidationError } from '../ValidationError';
import { HttpErrorFactory } from '../factories/HttpErrorFactory';

describe(TangoError, () => {
    it('recognizes tango errors and problem details payloads', () => {
        const error = new NotFoundError('x');
        expect(TangoError.isTangoError(error)).toBe(true);
        expect(TangoError.isTangoError({})).toBe(false);

        expect(TangoError.isProblemDetails({ code: 'x', message: 'y' })).toBe(true);
        expect(TangoError.isProblemDetails({ code: 1, message: 'y' })).toBe(false);
        expect(TangoError.isProblemDetails(null)).toBe(false);
    });

    it('renders envelopes and HttpError payloads', () => {
        const auth = new AuthenticationError();
        const conflict = new ConflictError('c');
        const permission = new PermissionDenied('p');
        const notFound = new NotFoundError('n');
        const validation = new ValidationError('v', { field: ['required'] });

        expect(auth.toErrorEnvelope()).toEqual({
            error: { code: 'authentication_error', message: 'Authentication required', details: undefined },
        });
        expect(conflict.toErrorEnvelope().error.code).toBe('conflict');
        expect(permission.toErrorEnvelope().error.code).toBe('permission_denied');
        expect(notFound.toErrorEnvelope().error.code).toBe('not_found');
        expect(validation.toErrorEnvelope().error.code).toBe('ValidationError');
        expect(validation.toErrorEnvelope().error.details).toEqual({ field: ['required'] });

        expect(notFound.toHttpError()).toEqual({
            status: 404,
            body: { error: 'n', details: undefined },
        });
    });

    it('identifies specific tango error types', () => {
        const auth = new AuthenticationError();
        const conflict = new ConflictError();
        const permission = new PermissionDenied();
        const notFound = new NotFoundError();
        const validation = new ValidationError('v');

        expect(AuthenticationError.isAuthenticationError(auth)).toBe(true);
        expect(ConflictError.isConflictError(conflict)).toBe(true);
        expect(PermissionDenied.isPermissionDenied(permission)).toBe(true);
        expect(NotFoundError.isNotFoundError(notFound)).toBe(true);
        expect(ValidationError.isValidationError(validation)).toBe(true);
        expect(ValidationError.isValidationError({ fields: { a: ['b'] } })).toBe(true);

        expect(AuthenticationError.isAuthenticationError({})).toBe(false);
        expect(ConflictError.isConflictError({})).toBe(false);
        expect(PermissionDenied.isPermissionDenied({})).toBe(false);
        expect(NotFoundError.isNotFoundError({})).toBe(false);
        expect(ValidationError.isValidationError({})).toBe(false);
    });

    it('falls back to the default error conversion for unknown failures', () => {
        const factory = new HttpErrorFactory();
        expect(HttpErrorFactory.isHttpErrorFactory(factory)).toBe(true);
        expect(HttpErrorFactory.isHttpErrorFactory({})).toBe(false);

        const generic = factory.create(new Error('x'));
        expect(generic.status).toBe(500);
        expect(generic.body.error).toBe('x');

        const unknown = HttpErrorFactory.toHttpError('not an error');
        expect(unknown.status).toBe(500);
        expect(unknown.body.error).toBe('Unknown error occurred');
    });

    it('maps zod-like validation errors to 400 by default', () => {
        const zodLike = Object.assign(new Error('Validation failed'), {
            name: 'ZodError',
            issues: [
                { path: ['excerpt'], message: 'Invalid input: expected string, received null' },
                { path: ['excerpt'], message: 'Excerpt is too long' },
                { path: [], message: 'Body is invalid' },
            ],
        });

        const httpError = HttpErrorFactory.toHttpError(zodLike);
        expect(httpError.status).toBe(400);
        expect(httpError.body.error).toBe('Validation failed');
        expect(httpError.body.details).toEqual({
            excerpt: ['Invalid input: expected string, received null', 'Excerpt is too long'],
            _schema: ['Body is invalid'],
        });
    });

    it('maps a real ZodError instance to 400 with field-grouped details', () => {
        const schema = z.object({
            title: z.string(),
            excerpt: z.string().max(10),
        });

        const result = schema.safeParse({ title: 42, excerpt: 'this string is way too long' });
        expect(result.success).toBe(false);
        if (result.success) return;

        const httpError = HttpErrorFactory.toHttpError(result.error);
        expect(httpError.status).toBe(400);
        expect(httpError.body.error).toBeTruthy();
        expect(httpError.body.details).toEqual(
            expect.objectContaining({
                title: expect.arrayContaining([expect.any(String)]),
                excerpt: expect.arrayContaining([expect.any(String)]),
            })
        );
    });

    it('falls back for empty zod error message and non-string issue messages', () => {
        const zodLike = Object.assign(new Error(''), {
            name: 'ZodError',
            issues: [{ path: ['excerpt'], message: 123 }],
        });

        const httpError = HttpErrorFactory.toHttpError(zodLike);
        expect(httpError.status).toBe(400);
        expect(httpError.body.error).toBe('Validation failed');
        expect(httpError.body.details).toEqual({
            excerpt: ['Invalid value'],
        });
    });
});
