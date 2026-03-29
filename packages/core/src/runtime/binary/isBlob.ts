import { hasTag } from '../internal/hasTag';

/**
 * Return true when a value is a `Blob`.
 */
export function isBlob(value: unknown): value is Blob {
    return hasTag(value, 'Blob');
}
