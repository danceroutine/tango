import type { OrderSpec } from './OrderSpec';
import type { QNode } from './QNode';

export interface QuerySetState<T, TSourceModel = unknown> {
    q?: QNode<T, TSourceModel>;
    excludes?: QNode<T, TSourceModel>[];
    order?: OrderSpec<T>[];
    limit?: number;
    offset?: number;
    cursor?: string | null;
    selectRelated?: string[];
    prefetchRelated?: string[];
    select?: (keyof T)[];
}
