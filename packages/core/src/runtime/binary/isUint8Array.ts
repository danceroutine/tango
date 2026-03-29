import { hasTag } from '../internal/hasTag';

/**
 * Return true when a value is a `Uint8Array`.
 */
export function isUint8Array(value: unknown): value is Uint8Array<ArrayBuffer> {
    return hasTag(value, 'Uint8Array');
}
