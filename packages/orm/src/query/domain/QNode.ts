import type { FilterInput } from './FilterInput';
import type { InternalQNodeType } from './internal/InternalQNodeType';

export type QNodeType = (typeof InternalQNodeType)[keyof typeof InternalQNodeType];

export interface QNode<T> {
    kind: QNodeType;
    where?: FilterInput<T>;
    nodes?: QNode<T>[];
    node?: QNode<T>;
}
