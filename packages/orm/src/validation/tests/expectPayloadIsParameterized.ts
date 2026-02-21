export function expectPayloadIsParameterized(sql: string, params: readonly unknown[], payload: string): void {
    if (sql.includes(payload)) {
        throw new Error(`Expected payload to stay out of SQL text, but found '${payload}' in '${sql}'.`);
    }

    if (!params.some((param) => param === payload)) {
        throw new Error(`Expected payload '${payload}' to be preserved as a bound parameter.`);
    }
}
