import { describe, it, expect } from 'vitest';
import { QBuilder as Q, QBuilder } from '../QBuilder';

describe(QBuilder, () => {
    it('builds a grouped all-of condition', () => {
        const node = Q.and<{ email: string; age: number }>({ email: 'test@example.com' }, { age: 30 });

        expect(node.kind).toBe('and');
        expect(node.nodes).toHaveLength(2);
        expect(node.nodes?.[0]).toEqual({ kind: 'atom', where: { email: 'test@example.com' } });
        expect(node.nodes?.[1]).toEqual({ kind: 'atom', where: { age: 30 } });
    });

    it('builds a grouped any-of condition', () => {
        const node = Q.or({ email: 'test@example.com' }, { email: 'admin@example.com' });

        expect(node.kind).toBe('or');
        expect(node.nodes).toHaveLength(2);
    });

    it('builds an inverted condition', () => {
        const node = Q.not({ email: 'test@example.com' });

        expect(node.kind).toBe('not');
        expect(node.node).toEqual({ kind: 'atom', where: { email: 'test@example.com' } });
    });

    it('nests Q nodes', () => {
        type ABC = { a: number; b: number; c: number };
        const node = Q.and<ABC>(Q.or<ABC>({ a: 1 }, { b: 2 }), { c: 3 });

        expect(node.kind).toBe('and');
        expect(node.nodes).toHaveLength(2);
        expect(node.nodes?.[0]!.kind).toBe('or');
        expect(node.nodes?.[1]).toEqual({ kind: 'atom', where: { c: 3 } });
    });
});
