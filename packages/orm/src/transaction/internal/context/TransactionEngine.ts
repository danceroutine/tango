import type { TangoRuntime } from '../../../runtime/TangoRuntime';
import type { TransactionClientLease } from '../../../runtime/internal/DBClientProvider';
import type { AtomicTransaction } from '../../AtomicTransaction';
import { AsyncLocalTransactionEngine } from './AsyncLocalTransactionEngine';

/**
 * Runtime-bound transaction facade used by internal ORM/runtime components.
 */
export class TransactionEngine {
    private static readonly engine = new AsyncLocalTransactionEngine();

    private constructor(private readonly runtime: TangoRuntime) {}

    static forRuntime(runtime: TangoRuntime): TransactionEngine {
        return new TransactionEngine(runtime);
    }

    static assertNoActiveAtomicTransaction(): void {
        this.engine.assertNoActiveAtomicTransaction();
    }

    getActiveTransaction(): AtomicTransaction | undefined {
        return TransactionEngine.engine.getActiveTransaction(this.runtime);
    }

    getActiveLease(): TransactionClientLease | undefined {
        return TransactionEngine.engine.getActiveLease(this.runtime);
    }

    async atomic<T>(work: (tx: AtomicTransaction) => Promise<T> | T): Promise<T> {
        return TransactionEngine.engine.atomic(this.runtime, work);
    }
}
