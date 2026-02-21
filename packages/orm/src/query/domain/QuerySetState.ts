import type { OrderSpec } from './OrderSpec';
import type { QNode } from './QNode';

export interface QuerySetState<T> {
    q?: QNode<T>;
    excludes?: QNode<T>[];
    order?: OrderSpec<T>[];
    limit?: number;
    offset?: number;
    cursor?: string | null;
    selectRelated?: string[];
    prefetchRelated?: string[];
    select?: (keyof T)[];
}
