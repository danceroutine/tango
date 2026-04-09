import { AsyncLocalStorage } from 'node:async_hooks';
import { getLogger } from '@danceroutine/tango-core';
import type { TangoRuntime } from '../../../runtime/TangoRuntime';
import type { TransactionClientLease } from '../../../runtime/internal/DBClientProvider';
import type { AtomicTransaction, SavepointOptions, SavepointResult } from '../../AtomicTransaction';
import type { CallbackRecord } from './CallbackRecord';
import { FrameBoundTransaction } from './FrameBoundTransaction';
import type { TransactionFrame } from './TransactionFrame';
import type { TransactionState } from './TransactionState';

export class AsyncLocalTransactionEngine {
    private readonly logger = getLogger('tango.orm.transaction');
    private readonly storage = new AsyncLocalStorage<TransactionState>();

    assertNoActiveAtomicTransaction(): void {
        if (this.storage.getStore()) {
            throw new Error('UnitOfWork is unsupported inside transaction.atomic(...).');
        }
    }

    getActiveTransaction(runtime: TangoRuntime): AtomicTransaction | undefined {
        const state = this.storage.getStore();
        if (!state || state.runtime !== runtime) {
            return undefined;
        }

        return state.frames.at(-1)?.facade;
    }

    getActiveLease(runtime: TangoRuntime): TransactionClientLease | undefined {
        const state = this.storage.getStore();
        if (!state || state.runtime !== runtime) {
            return undefined;
        }

        return state.lease;
    }

    async atomic<T>(runtime: TangoRuntime, work: (tx: AtomicTransaction) => Promise<T> | T): Promise<T> {
        const existing = this.storage.getStore();
        if (existing) {
            if (existing.runtime !== runtime) {
                throw new Error(
                    'Cannot open a transaction for one Tango runtime while another runtime transaction is active.'
                );
            }

            return this.runNested(existing, work);
        }

        const lease = await runtime.leaseTransactionClient();
        const state: TransactionState = {
            runtime,
            lease,
            frames: [],
            nextCallbackOrder: 0,
            nextSavepointId: 0,
        };

        try {
            return await this.storage.run(state, async () => {
                await lease.client.begin();
                const frame = this.pushFrame(state);

                try {
                    const result = await work(frame.facade);
                    await lease.client.commit();
                    const root = this.popFrame(state);
                    root.facade.deactivate();
                    await this.runCommittedCallbacks(root.callbacks);
                    return result;
                } catch (error) {
                    await this.rollbackOuter(state, error);
                    throw error;
                }
            });
        } finally {
            this.deactivateAllFrames(state);
            await lease.release();
        }
    }

    async runSavepoint<T>(
        state: TransactionState,
        work: (tx: AtomicTransaction) => Promise<T> | T,
        options: SavepointOptions
    ): Promise<T | SavepointResult<T>> {
        try {
            const value = await this.runNested(state, work);
            if (options.throwOnError) {
                return value;
            }

            return {
                ok: true,
                value,
            };
        } catch (error) {
            if (options.throwOnError) {
                throw error;
            }

            return {
                ok: false,
                error,
            };
        }
    }

    private async runNested<T>(state: TransactionState, work: (tx: AtomicTransaction) => Promise<T> | T): Promise<T> {
        const savepointName = `tango_sp_${state.nextSavepointId++}`;
        await state.lease.client.createSavepoint(savepointName);
        const frame = this.pushFrame(state, savepointName);

        try {
            const result = await work(frame.facade);
            await state.lease.client.releaseSavepoint(savepointName);
            const completed = this.popFrame(state);
            completed.facade.deactivate();
            const parent = state.frames.at(-1);
            if (!parent) {
                throw new Error('Nested transaction frame completed without a parent frame.');
            }

            parent.callbacks.push(...completed.callbacks);
            parent.callbacks.sort((left, right) => left.order - right.order);
            return result;
        } catch (error) {
            try {
                await state.lease.client.rollbackToSavepoint(savepointName);
            } catch (rollbackError) {
                throw this.attachCause(rollbackError, error);
            } finally {
                const discarded = this.popFrame(state);
                discarded.facade.deactivate();
            }

            throw error;
        }
    }

    private pushFrame(state: TransactionState, savepointName?: string): TransactionFrame {
        const frame = {} as TransactionFrame;
        const facade = new FrameBoundTransaction(this, state, frame);
        frame.callbacks = [];
        frame.facade = facade;
        frame.savepointName = savepointName;
        state.frames.push(frame);
        return frame;
    }

    private popFrame(state: TransactionState): TransactionFrame {
        const frame = state.frames.pop();
        if (!frame) {
            throw new Error('Transaction frame stack underflow.');
        }

        return frame;
    }

    private async rollbackOuter(state: TransactionState, error: unknown): Promise<void> {
        try {
            await state.lease.client.rollback();
        } catch (rollbackError) {
            throw this.attachCause(rollbackError, error);
        } finally {
            while (state.frames.length > 0) {
                const frame = this.popFrame(state);
                frame.facade.deactivate();
            }
        }
    }

    private async runCommittedCallbacks(callbacks: readonly CallbackRecord[]): Promise<void> {
        for (const record of callbacks) {
            try {
                await record.callback();
            } catch (error) {
                if (!record.robust) {
                    throw error;
                }

                try {
                    this.logger.error('Post-commit callback failed.', error);
                } catch {
                    // A logging backend failure cannot change the already-committed outcome.
                }
            }
        }
    }

    private deactivateAllFrames(state: TransactionState): void {
        state.frames.length = 0;
    }

    private attachCause(error: unknown, cause: unknown): unknown {
        if (!this.isErrorValue(error)) {
            return error;
        }

        if ('cause' in error && error.cause !== undefined) {
            return error;
        }

        try {
            return new Error(error.message, { cause });
        } catch {
            return error;
        }
    }

    private isErrorValue(value: unknown): value is Error {
        return (
            typeof value === 'object' &&
            value !== null &&
            typeof (value as { message?: unknown }).message === 'string' &&
            typeof (value as { name?: unknown }).name === 'string'
        );
    }
}
