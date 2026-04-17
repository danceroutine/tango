/**
 * Assert that a query result matches an expected value using structural equality.
 */
export async function expectQueryResult<T>(actual: Promise<T> | T, expected: T): Promise<void> {
    const resolved = await actual;

    const resolvedJson = JSON.stringify(resolved);
    const expectedJson = JSON.stringify(expected);

    if (resolvedJson !== expectedJson) {
        throw new Error(`Expected query result ${expectedJson}, got ${resolvedJson}`);
    }
}
