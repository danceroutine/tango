import { hasTag } from '../internal/hasTag';

/**
 * Return true when a value is a web `File`.
 */
export function isFile(value: unknown): value is File {
    return hasTag(value, 'File');
}
