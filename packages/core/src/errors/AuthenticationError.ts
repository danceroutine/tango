import { TangoError, type ErrorDetails } from './TangoError';

/** Error for missing/invalid authentication (HTTP 401). */
export class AuthenticationError extends TangoError {
    static readonly BRAND = 'tango.error.authentication' as const;
    readonly __tangoBrand: typeof AuthenticationError.BRAND = AuthenticationError.BRAND;
    status = 401;

    /** Create an authentication error with optional custom message. */
    constructor(message: string = 'Authentication required') {
        super(message);
        this.name = 'AuthenticationError';
        Object.setPrototypeOf(this, AuthenticationError.prototype);
    }

    /**
     * Narrow an unknown value to `AuthenticationError`.
     */
    static isAuthenticationError(value: unknown): value is AuthenticationError {
        return (
            typeof value === 'object' &&
            value !== null &&
            (value as { __tangoBrand?: unknown }).__tangoBrand === AuthenticationError.BRAND
        );
    }

    protected override getErrorName(): string {
        return 'authentication_error';
    }

    protected override getDetails(): ErrorDetails {
        return undefined;
    }
}
