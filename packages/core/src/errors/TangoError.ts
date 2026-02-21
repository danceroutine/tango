import type { HttpError } from './HttpError';

/** Structured error detail payload for API responses. */
export type ErrorDetails = Record<string, string[]> | null | undefined;

/** Canonical error payload shape used by Tango HTTP error responses. */
export type ProblemDetails<TDetails extends ErrorDetails = null> = {
    code: string;
    message: string;
    details?: TDetails;
    fields?: Record<string, string[]>;
};

/** Envelope shape for serialized error responses. */
export type ErrorEnvelope<TDetails extends ErrorDetails = null> = {
    error: ProblemDetails<TDetails>;
};

/**
 * Base branded framework error.
 *
 * Subclasses provide HTTP status, stable code, and structured details.
 */
export abstract class TangoError extends Error {
    // String brand avoids instanceof and survives cross-package boundaries.
    readonly __tangoErrorBrand = 'tango.error' as const;
    abstract status: number;

    protected abstract getDetails(): ErrorDetails;

    protected abstract getErrorName(): string;

    /** Runtime guard for Tango-branded errors. */
    static isTangoError(err: unknown): err is TangoError {
        return !!err && (err as { __tangoErrorBrand?: string }).__tangoErrorBrand === 'tango.error';
    }

    /** Runtime guard for plain problem-details objects. */
    static isProblemDetails(err: unknown): err is ProblemDetails {
        return (
            !!err &&
            typeof err === 'object' &&
            err !== null &&
            'code' in err &&
            typeof (err as { code: unknown }).code === 'string' &&
            'message' in err &&
            typeof (err as { message: unknown }).message === 'string'
        );
    }

    /** Convert this error to wire-level envelope format. */
    toErrorEnvelope(): ErrorEnvelope<ErrorDetails> {
        return {
            error: {
                code: this.getErrorName(),
                message: this.message,
                details: this.getDetails(),
            },
        };
    }

    /** Convert this error to legacy `HttpError` shape. */
    toHttpError(): HttpError {
        return {
            status: this.status,
            body: {
                error: this.message,
                details: this.getDetails(),
            },
        };
    }
}
