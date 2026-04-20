import { TangoError, type ErrorDetails } from './TangoError';

/** Error when a queryset lookup returns more than one row (HTTP 409). */
export class MultipleObjectsReturned extends TangoError {
    static readonly BRAND = 'tango.error.multiple_objects_returned' as const;
    readonly __tangoBrand: typeof MultipleObjectsReturned.BRAND = MultipleObjectsReturned.BRAND;
    status = 409;

    constructor(message: string = 'Multiple objects returned') {
        super(message);
        this.name = 'MultipleObjectsReturned';
        Object.setPrototypeOf(this, MultipleObjectsReturned.prototype);
    }

    static isMultipleObjectsReturned(value: unknown): value is MultipleObjectsReturned {
        return (
            typeof value === 'object' &&
            value !== null &&
            (value as { __tangoBrand?: unknown }).__tangoBrand === MultipleObjectsReturned.BRAND
        );
    }

    protected override getErrorName(): string {
        return 'multiple_objects_returned';
    }

    protected override getDetails(): ErrorDetails {
        return undefined;
    }
}
