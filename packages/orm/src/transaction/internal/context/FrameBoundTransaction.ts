import type { AtomicTransaction, OnCommitOptions, SavepointOptions, SavepointResult } from '../../AtomicTransaction';
import type { AsyncLocalTransactionEngine } from './AsyncLocalTransactionEngine';
import type { TransactionFrame } from './TransactionFrame';
import type { TransactionState } from './TransactionState';

export class FrameBoundTransaction implements AtomicTransaction {
    private active = true;

    constructor(
        private readonly engine: AsyncLocalTransactionEngine,
        private readonly state: TransactionState,
        private readonly frame: TransactionFrame
    ) {}

    onCommit(callback: () => void, options: OnCommitOptions = {}): void {
        if (!this.active) {
            throw new Error('Cannot register an on-commit callback on an inactive transaction frame.');
        }

        this.frame.callbacks.push({
            order: this.state.nextCallbackOrder++,
            callback,
            robust: options.robust ?? false,
        });
    }

    savepoint<T>(work: (tx: AtomicTransaction) => Promise<T> | T): Promise<SavepointResult<T>>;
    savepoint<T>(
        work: (tx: AtomicTransaction) => Promise<T> | T,
        options: { throwOnError: false }
    ): Promise<SavepointResult<T>>;
    savepoint<T>(work: (tx: AtomicTransaction) => Promise<T> | T, options: { throwOnError: true }): Promise<T>;
    async savepoint<T>(
        work: (tx: AtomicTransaction) => Promise<T> | T,
        options: SavepointOptions = {}
    ): Promise<T | SavepointResult<T>> {
        if (!this.active) {
            throw new Error('Cannot open a savepoint from an inactive transaction frame.');
        }

        return this.engine.runSavepoint(this.state, work, options);
    }

    deactivate(): void {
        this.active = false;
    }
}
