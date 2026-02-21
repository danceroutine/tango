import { hasTag } from '../internal/hasTag';

/**
 * Return true when a value is a `Date`.
 */
export function isDate(value: unknown): value is Date {
    return hasTag(value, 'Date');
}
