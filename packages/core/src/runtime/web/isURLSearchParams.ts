import { hasTag } from '../internal/hasTag';

/**
 * Return true when a value is `URLSearchParams`.
 */
export function isURLSearchParams(value: unknown): value is URLSearchParams {
    return hasTag(value, 'URLSearchParams');
}
