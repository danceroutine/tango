import type { AtomicTransaction } from '../../AtomicTransaction';

export interface FrameTransactionHandle extends AtomicTransaction {
    deactivate(): void;
}
