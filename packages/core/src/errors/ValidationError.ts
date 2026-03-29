import { TangoError, type ErrorDetails } from './TangoError';

/** Error for request validation failures (HTTP 400). */
export class ValidationError extends TangoError {
    readonly __tangoValidationErrorBrand = 'tango.error.validation' as const;
    status = 400;

    constructor(
        message: string,
        public details?: ErrorDetails
    ) {
        super(message);
        this.name = 'ValidationError';
        Object.setPrototypeOf(this, ValidationError.prototype);
    }

    /**
     * Narrow an unknown value to `ValidationError`, including common legacy shapes.
     */
    static isValidationError(err: unknown): err is ValidationError {
        return (
            (!!err &&
                typeof err === 'object' &&
                (err as { __tangoValidationErrorBrand?: string }).__tangoValidationErrorBrand ===
                    'tango.error.validation') ||
            (typeof err === 'object' &&
                err !== null &&
                'fields' in err &&
                typeof (err as { fields: unknown }).fields === 'object')
        );
    }

    protected override getErrorName(): string {
        return 'ValidationError';
    }

    protected override getDetails(): ErrorDetails {
        return this.details;
    }
}
