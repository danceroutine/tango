import type { QNode } from './domain/QNode';
import type { FilterInput } from './domain/FilterInput';
import { InternalQNodeType } from './domain/internal/InternalQNodeType';

/**
 * Static builder for composing boolean query expressions.
 *
 * This mirrors Django's `Q(...)` composition patterns and is intended
 * for ergonomic construction of nested `AND`/`OR`/`NOT` trees.
 */
export class QBuilder {
    static readonly BRAND = 'tango.orm.q_builder' as const;
    readonly __tangoBrand: typeof QBuilder.BRAND = QBuilder.BRAND;

    /**
     * Narrow an unknown value to `QBuilder`.
     */
    static isQBuilder(value: unknown): value is QBuilder {
        return (
            typeof value === 'object' &&
            value !== null &&
            (value as { __tangoBrand?: unknown }).__tangoBrand === QBuilder.BRAND
        );
    }

    /**
     * Combine multiple filter fragments using logical `AND`.
     */
    static and<T>(...nodes: Array<FilterInput<T> | QNode<T>>): QNode<T> {
        return {
            kind: InternalQNodeType.AND,
            nodes: nodes.map(QBuilder.wrapNode),
        };
    }

    /**
     * Combine multiple filter fragments using logical `OR`.
     */
    static or<T>(...nodes: Array<FilterInput<T> | QNode<T>>): QNode<T> {
        return {
            kind: InternalQNodeType.OR,
            nodes: nodes.map(QBuilder.wrapNode),
        };
    }

    /**
     * Negate a filter fragment using logical `NOT`.
     */
    static not<T>(node: FilterInput<T> | QNode<T>): QNode<T> {
        return {
            kind: InternalQNodeType.NOT,
            node: QBuilder.wrapNode(node),
        };
    }

    private static wrapNode<T>(input: FilterInput<T> | QNode<T>): QNode<T> {
        if ((input as QNode<T>).kind) {
            return input as QNode<T>;
        }
        return {
            kind: InternalQNodeType.ATOM,
            where: input as FilterInput<T>,
        };
    }
}
