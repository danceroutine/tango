export type SqliteStatementLike = {
    readonly reader: boolean;
    all(...params: unknown[]): unknown[];
    run(...params: unknown[]): unknown;
};

export type SqliteDatabaseLike = {
    prepare(sql: string): SqliteStatementLike;
    pragma(sql: string): unknown;
    close(): void;
};

export type SqliteDatabaseConstructor = new (filename: string, options?: unknown) => SqliteDatabaseLike;
