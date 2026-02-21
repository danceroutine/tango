export function hasConstructorName(value: unknown, name: string): boolean {
    return (
        !!value &&
        typeof value === 'object' &&
        (value as { constructor?: { name?: unknown } }).constructor?.name === name
    );
}
