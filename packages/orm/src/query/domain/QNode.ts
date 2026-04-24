import type { FilterInput } from './FilterInput';
import type { InternalQNodeType } from './internal/InternalQNodeType';

export type QNodeType = (typeof InternalQNodeType)[keyof typeof InternalQNodeType];

export interface QNode<T, TSourceModel = unknown> {
    kind: QNodeType;
    where?: FilterInput<T, TSourceModel>;
    nodes?: QNode<T, TSourceModel>[];
    node?: QNode<T, TSourceModel>;
}
