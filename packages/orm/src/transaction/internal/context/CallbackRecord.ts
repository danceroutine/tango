export type CallbackRecord = {
    order: number;
    callback: () => void;
    robust: boolean;
};
