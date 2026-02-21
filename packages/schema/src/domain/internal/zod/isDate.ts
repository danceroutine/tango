export function isDate(value: unknown): value is Date {
    return value !== null && value !== undefined && Object.prototype.toString.call(value) === '[object Date]';
}
