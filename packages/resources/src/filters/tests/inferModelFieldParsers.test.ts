import { describe, expect, it } from 'vitest';
import { inferModelFieldParsers } from '../inferModelFieldParsers';
import type { ResourceModelLike } from '../../resource/index';

type TestModel = {
    id: number;
    active: boolean;
    email: string;
    createdAt: string;
    visits: number;
};

describe(inferModelFieldParsers, () => {
    it('returns no parsers when resource metadata is missing', () => {
        const model: ResourceModelLike<TestModel> = {
            objects: {} as never,
        } as unknown as ResourceModelLike<TestModel>;

        expect(inferModelFieldParsers(model)).toEqual({});
    });

    it('infers boolean parsers from model metadata', () => {
        const model: ResourceModelLike<TestModel> = {
            objects: {} as never,
            metadata: {
                name: 'TestModel',
                fields: [
                    { name: 'id', type: 'serial', primaryKey: true },
                    { name: 'active', type: 'bool' },
                    { name: 'email', type: 'text' },
                    { name: 'createdAt', type: 'timestamptz' },
                    { name: 'visits', type: 'bigint' },
                ],
            },
        } as unknown as ResourceModelLike<TestModel>;

        const parsers = inferModelFieldParsers(model);
        expect(parsers.id?.('7')).toBe(7);
        expect(parsers.email).toBeUndefined();
        expect(parsers.active?.('true')).toBe(true);
        expect(parsers.active?.('1')).toBe(true);
        expect(parsers.active?.('false')).toBe(false);
        expect(parsers.active?.('0')).toBe(false);
        expect(parsers.active?.(['false'])).toBe(false);
        expect(parsers.active?.('true,false')).toEqual([true, false]);
        expect(parsers.active?.(['true', 'false'])).toEqual([true, false]);
        expect(parsers.active?.('')).toBeUndefined();
        expect(parsers.active?.('true,')).toBeUndefined();
        expect(parsers.active?.('wat')).toBeUndefined();
        expect(parsers.visits?.('42')).toBe(42);
        expect(parsers.visits?.('oops')).toBeUndefined();
        expect(parsers.visits?.('1,2,3')).toEqual([1, 2, 3]);
        expect(parsers.visits?.(['4', '5'])).toEqual([4, 5]);
        expect(parsers.visits?.('')).toBeUndefined();
        expect(parsers.visits?.('1,')).toBeUndefined();
        expect(parsers.visits?.(['6', ''])).toBeUndefined();
        expect(parsers.createdAt?.('2024-01-01T00:00:00.000Z')).toEqual(new Date('2024-01-01T00:00:00.000Z'));
        expect(parsers.createdAt?.('nope')).toBeUndefined();
        expect(parsers.createdAt?.('2024-01-01T00:00:00.000Z,2024-01-02T00:00:00.000Z')).toEqual([
            new Date('2024-01-01T00:00:00.000Z'),
            new Date('2024-01-02T00:00:00.000Z'),
        ]);
        expect(parsers.createdAt?.(['2024-01-03T00:00:00.000Z', '2024-01-04T00:00:00.000Z'])).toEqual([
            new Date('2024-01-03T00:00:00.000Z'),
            new Date('2024-01-04T00:00:00.000Z'),
        ]);
        expect(parsers.createdAt?.('')).toBeUndefined();
        expect(parsers.createdAt?.('2024-01-01T00:00:00.000Z,')).toBeUndefined();
    });
});
