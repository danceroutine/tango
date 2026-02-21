import { hasTag } from '../internal/hasTag';

/**
 * Return true when a value is an `ArrayBuffer`.
 */
export function isArrayBuffer(value: unknown): value is ArrayBuffer {
    return hasTag(value, 'ArrayBuffer');
}
