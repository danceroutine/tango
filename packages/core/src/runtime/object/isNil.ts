/**
 * Return true when a value is `null` or `undefined`.
 */
export function isNil(value: unknown): value is null | undefined {
    return value === null || value === undefined;
}
