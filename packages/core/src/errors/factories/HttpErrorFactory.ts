import { TangoError } from '../TangoError';
import type { HttpError } from '../HttpError';
import { isError, isObject } from '../../runtime/index';

export interface HttpErrorFactoryConfig {
    /**
     * When true, raw error messages are included in HTTP responses.
     * When false, generic messages are returned for non-TangoError exceptions.
     * Defaults to true (dev-friendly). Set to false in production.
     */
    exposeErrors?: boolean;
}

type ZodLikeIssue = {
    path?: unknown[];
    message?: unknown;
};

type ZodLikeError = Error & {
    issues: ZodLikeIssue[];
};

/**
 * Converts errors into structured HTTP error responses.
 * Supports TangoError subclasses out of the box, and custom error handlers
 * can be registered for third-party or application-specific error types.
 *
 * @example
 * ```typescript
 * // Development (default) — exposes real error messages
 * const devFactory = new HttpErrorFactory();
 *
 * // Production — hides internal error details
 * const prodFactory = new HttpErrorFactory({ exposeErrors: false });
 *
 * // Register a custom handler for a third-party error
 * prodFactory.registerHandler(ZodError, (err) => ({
 *   status: 400,
 *   body: { error: 'Validation failed', details: err.flatten().fieldErrors },
 * }));
 *
 * // Quick one-shot conversion with dev defaults
 * const httpError = HttpErrorFactory.toHttpError(new NotFoundError('missing'));
 * ```
 */
export class HttpErrorFactory {
    static readonly BRAND = 'tango.error_factory.http' as const;
    readonly __tangoBrand: typeof HttpErrorFactory.BRAND = HttpErrorFactory.BRAND;

    // oxlint-disable-next-line typescript/no-explicit-any
    private handlers = new Map<new (...args: any[]) => Error, (error: Error) => HttpError>();
    private exposeErrors: boolean;

    constructor(config: HttpErrorFactoryConfig = {}) {
        this.exposeErrors = config.exposeErrors ?? true;
    }

    /**
     * Narrow an unknown value to `HttpErrorFactory`.
     */
    static isHttpErrorFactory(value: unknown): value is HttpErrorFactory {
        return (
            typeof value === 'object' &&
            value !== null &&
            (value as { __tangoBrand?: unknown }).__tangoBrand === HttpErrorFactory.BRAND
        );
    }

    /**
     * Convert an unknown error into an `HttpError` using dev-friendly defaults.
     * Shorthand for `new HttpErrorFactory().create(error)`.
     */
    static toHttpError(error: unknown): HttpError {
        return new HttpErrorFactory().create(error);
    }

    private static isZodLikeValidationError(error: unknown): error is ZodLikeError {
        return (
            isError(error) &&
            isObject(error) &&
            Array.isArray((error as { issues?: unknown }).issues) &&
            (error as { name?: unknown }).name === 'ZodError'
        );
    }

    private static zodLikeErrorDetails(error: ZodLikeError): Record<string, string[]> {
        const details: Record<string, string[]> = {};

        for (const issue of error.issues) {
            const key = Array.isArray(issue.path) && issue.path.length > 0 ? String(issue.path.join('.')) : '_schema';
            const message = typeof issue.message === 'string' ? issue.message : 'Invalid value';

            const existing = details[key];
            if (existing) {
                existing.push(message);
            } else {
                details[key] = [message];
            }
        }

        return details;
    }

    /**
     * Register a custom mapper for an application or third-party error type.
     */

    // oxlint-disable-next-line typescript/no-explicit-any
    registerHandler<T extends Error>(errorClass: new (...args: any[]) => T, handler: (error: T) => HttpError): this {
        this.handlers.set(errorClass, handler as (error: Error) => HttpError);
        return this;
    }

    /**
     * Convert an unknown error into the normalized HTTP error shape Tango uses.
     */
    create(error: unknown): HttpError {
        if (TangoError.isTangoError(error)) {
            return error.toHttpError();
        }

        if (HttpErrorFactory.isZodLikeValidationError(error)) {
            return {
                status: 400,
                body: {
                    error: error.message || 'Validation failed',
                    details: HttpErrorFactory.zodLikeErrorDetails(error),
                },
            };
        }

        for (const [ErrorClass, handler] of this.handlers) {
            if (this.isErrorClassInstance(error, ErrorClass)) {
                return handler(error);
            }
        }

        if (isError(error)) {
            return {
                status: 500,
                body: {
                    error: this.exposeErrors ? error.message : 'Internal Server Error',
                    details: null,
                },
            };
        }

        return {
            status: 500,
            body: {
                error: 'Unknown error occurred',
                details: null,
            },
        };
    }

    // oxlint-disable-next-line typescript/no-explicit-any
    private isErrorClassInstance(error: unknown, ErrorClass: new (...args: any[]) => Error): error is Error {
        if (!isError(error)) {
            return false;
        }

        const expectedBrand = (ErrorClass as { BRAND?: unknown }).BRAND;
        if (
            typeof expectedBrand === 'string' &&
            isObject(error) &&
            (error as { __tangoBrand?: unknown }).__tangoBrand === expectedBrand
        ) {
            return true;
        }

        const constructorName = (error as { constructor?: { name?: unknown } }).constructor?.name;
        if (typeof constructorName === 'string' && constructorName === ErrorClass.name) {
            return true;
        }

        const errorName = (error as { name?: unknown }).name;
        if (typeof errorName === 'string' && errorName === ErrorClass.name) {
            return true;
        }

        return false;
    }
}
