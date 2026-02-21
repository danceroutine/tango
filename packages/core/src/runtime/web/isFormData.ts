import { hasTag } from '../internal/hasTag';

/**
 * Return true when a value is `FormData`.
 */
export function isFormData(value: unknown): value is FormData {
    return hasTag(value, 'FormData');
}
