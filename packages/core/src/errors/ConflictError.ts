import { TangoError, type ErrorDetails } from './TangoError';

/** Error for conflicting resource state (HTTP 409). */
export class ConflictError extends TangoError {
    static readonly BRAND = 'tango.error.conflict' as const;
    readonly __tangoBrand: typeof ConflictError.BRAND = ConflictError.BRAND;
    status = 409;

    /** Create a conflict error with optional custom message. */
    constructor(message: string = 'Resource conflict') {
        super(message);
        this.name = 'ConflictError';
        Object.setPrototypeOf(this, ConflictError.prototype);
    }

    /**
     * Narrow an unknown value to `ConflictError`.
     */
    static isConflictError(value: unknown): value is ConflictError {
        return (
            typeof value === 'object' &&
            value !== null &&
            (value as { __tangoBrand?: unknown }).__tangoBrand === ConflictError.BRAND
        );
    }

    protected override getErrorName(): string {
        return 'conflict';
    }

    protected override getDetails(): ErrorDetails {
        return undefined;
    }
}
