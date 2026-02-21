import { isObject } from '../object/isObject';

/**
 * Return true when a value looks like an `Error`.
 */
export function isError(value: unknown): value is Error {
    return (
        isObject(value) &&
        typeof (value as { name?: unknown }).name === 'string' &&
        typeof (value as { message?: unknown }).message === 'string'
    );
}
