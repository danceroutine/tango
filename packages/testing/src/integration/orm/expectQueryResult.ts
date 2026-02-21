/**
 * Assert that a query result matches an expected value using structural equality.
 */
export async function expectQueryResult<T>(actual: Promise<T> | T, expected: T): Promise<void> {
    const resolved = await actual;

    if (JSON.stringify(resolved) !== JSON.stringify(expected)) {
        throw new Error(`Expected query result ${JSON.stringify(expected)}, got ${JSON.stringify(resolved)}`);
    }
}
