import { getTangoRuntime } from '../runtime/defaultRuntime';
import type { AtomicTransaction } from './AtomicTransaction';
import { TransactionEngine } from './internal/context';

export async function atomic<T>(work: (tx: AtomicTransaction) => Promise<T> | T): Promise<T> {
    return TransactionEngine.forRuntime(getTangoRuntime()).atomic(work);
}
