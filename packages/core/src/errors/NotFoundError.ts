import { TangoError, type ErrorDetails } from './TangoError';

/** Error for missing resources (HTTP 404). */
export class NotFoundError extends TangoError {
    static readonly BRAND = 'tango.error.not_found' as const;
    readonly __tangoBrand: typeof NotFoundError.BRAND = NotFoundError.BRAND;
    status = 404;

    /** Create a not-found error with optional custom message. */
    constructor(message: string = 'Resource not found') {
        super(message);
        this.name = 'NotFoundError';
        Object.setPrototypeOf(this, NotFoundError.prototype);
    }

    /**
     * Narrow an unknown value to `NotFoundError`.
     */
    static isNotFoundError(value: unknown): value is NotFoundError {
        return (
            typeof value === 'object' &&
            value !== null &&
            (value as { __tangoBrand?: unknown }).__tangoBrand === NotFoundError.BRAND
        );
    }

    protected override getErrorName(): string {
        return 'not_found';
    }

    protected override getDetails(): ErrorDetails {
        return undefined;
    }
}
