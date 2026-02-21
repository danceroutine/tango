import { TangoError, type ErrorDetails } from './TangoError';

/** Error for authorization failures (HTTP 403). */
export class PermissionDenied extends TangoError {
    static readonly BRAND = 'tango.error.permission_denied' as const;
    readonly __tangoBrand: typeof PermissionDenied.BRAND = PermissionDenied.BRAND;
    status = 403;

    /** Create a permission-denied error with optional custom message. */
    constructor(message: string = 'Permission denied') {
        super(message);
        this.name = 'PermissionDenied';
        Object.setPrototypeOf(this, PermissionDenied.prototype);
    }

    /**
     * Narrow an unknown value to `PermissionDenied`.
     */
    static isPermissionDenied(value: unknown): value is PermissionDenied {
        return (
            typeof value === 'object' &&
            value !== null &&
            (value as { __tangoBrand?: unknown }).__tangoBrand === PermissionDenied.BRAND
        );
    }

    protected override getErrorName(): string {
        return 'permission_denied';
    }

    protected override getDetails(): ErrorDetails {
        return undefined;
    }
}
