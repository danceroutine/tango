/**
 * Install a temporary global test API for the duration of one callback.
 *
 * This is useful for module-loading tests that need a stable escape hatch into
 * already-imported symbols without introducing a second copy of the same package.
 */
export async function withGlobalTestApi<TValue, TResult>(
    key: string,
    value: TValue,
    work: () => TResult | Promise<TResult>
): Promise<TResult> {
    const globalRecord = globalThis as Record<string, unknown>;
    const previousValue = globalRecord[key];
    const hadPreviousValue = Object.prototype.hasOwnProperty.call(globalRecord, key);

    globalRecord[key] = value;
    try {
        return await work();
    } finally {
        if (hadPreviousValue) {
            globalRecord[key] = previousValue;
        } else {
            delete globalRecord[key];
        }
    }
}
