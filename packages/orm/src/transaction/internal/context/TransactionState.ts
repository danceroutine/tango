import type { TangoRuntime } from '../../../runtime/TangoRuntime';
import type { TransactionClientLease } from '../../../runtime/internal/DBClientProvider';
import type { TransactionFrame } from './TransactionFrame';

export type TransactionState = {
    runtime: TangoRuntime;
    lease: TransactionClientLease;
    frames: TransactionFrame[];
    nextCallbackOrder: number;
    nextSavepointId: number;
};
