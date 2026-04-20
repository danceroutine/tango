import { describe, expect, it } from 'vitest';
import { InternalQNodeType } from '../../domain/internal/InternalQNodeType';
import { isQNodeLike } from '../isQNodeLike';

type KindedRow = {
    id: number;
    kind: string;
};

describe(isQNodeLike, () => {
    it('rejects null and branded objects', () => {
        expect(isQNodeLike(null as never)).toBe(false);
        expect(isQNodeLike({ __tangoBrand: 'tango.orm.q_builder' } as never)).toBe(false);
    });

    it('distinguishes filter objects from real Q node shapes', () => {
        expect(isQNodeLike<KindedRow>({ kind: 'news' } as never)).toBe(false);
        expect(isQNodeLike<KindedRow>({ kind: InternalQNodeType.ATOM, where: { id: 1 } })).toBe(true);
        expect(isQNodeLike<KindedRow>({ kind: InternalQNodeType.AND, nodes: [] })).toBe(true);
        expect(
            isQNodeLike<KindedRow>({
                kind: InternalQNodeType.NOT,
                node: { kind: InternalQNodeType.ATOM, where: { id: 1 } },
            })
        ).toBe(true);
    });
});
