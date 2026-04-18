import type { FilterInput } from '../domain/FilterInput';
import type { QNode } from '../domain/QNode';
import { InternalQNodeType } from '../domain/internal/InternalQNodeType';

export function isQNodeLike<T>(value: FilterInput<T> | QNode<T>): value is QNode<T> {
    if (typeof value !== 'object' || value === null || '__tangoBrand' in value) {
        return false;
    }

    switch ((value as { kind?: unknown }).kind) {
        case InternalQNodeType.ATOM:
            return 'where' in value;
        case InternalQNodeType.AND:
        case InternalQNodeType.OR:
            return Array.isArray((value as { nodes?: unknown }).nodes);
        case InternalQNodeType.NOT:
            return 'node' in value;
        default:
            return false;
    }
}
