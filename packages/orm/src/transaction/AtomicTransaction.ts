export interface OnCommitOptions {
    robust?: boolean;
}

export interface SavepointOptions {
    throwOnError?: boolean;
}

/**
 * Result returned by `tx.savepoint(...)`.
 */
export type SavepointResult<T> =
    | {
          ok: true;
          value: T;
      }
    | {
          ok: false;
          error: unknown;
      };

export interface AtomicTransaction {
    /**
     * Register a callback that should run only after the outermost transaction commit succeeds.
     */
    onCommit(callback: () => void, options?: OnCommitOptions): void;

    /**
     * Run work inside a nested savepoint and, by default, capture rollback as a result object instead of throwing.
     */
    savepoint<T>(work: (tx: AtomicTransaction) => Promise<T> | T): Promise<SavepointResult<T>>;
    savepoint<T>(
        work: (tx: AtomicTransaction) => Promise<T> | T,
        options: { throwOnError: false }
    ): Promise<SavepointResult<T>>;
    savepoint<T>(work: (tx: AtomicTransaction) => Promise<T> | T, options: { throwOnError: true }): Promise<T>;
}
