import type { CallbackRecord } from './CallbackRecord';
import type { FrameTransactionHandle } from './FrameTransactionHandle';

export type TransactionFrame = {
    callbacks: CallbackRecord[];
    facade: FrameTransactionHandle;
    savepointName?: string;
};
