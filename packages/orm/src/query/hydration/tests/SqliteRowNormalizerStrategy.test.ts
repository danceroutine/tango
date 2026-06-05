import { describe, expect, it } from 'vitest';
import {
    createQueryRowNormalizerStrategy,
    PassthroughQueryRowNormalizerStrategy,
    SqliteRowNormalizerStrategy,
} from '../QueryRowNormalizerStrategy';

describe(SqliteRowNormalizerStrategy, () => {
    it('normalizes root and parser rows from sqlite boolean storage values', () => {
        const strategy = new SqliteRowNormalizerStrategy();
        const rows = [{ id: 1, active: 1, archived: '0', count: 2 }];
        const columns = { id: 'int', active: 'bool', archived: 'boolean', count: 'int' };

        expect(strategy.normalizeRootRows(rows, columns)).toEqual([{ id: 1, active: true, archived: false, count: 2 }]);
        expect(strategy.normalizeHydratedRowsForParserShape(rows, columns)).toEqual([
            { id: 1, active: true, archived: false, count: 2 },
        ]);
    });

    it('normalizes joined and prefetched target rows from target column metadata', () => {
        const strategy = new SqliteRowNormalizerStrategy();

        expect(strategy.normalizeTargetRow({ id: 1, enabled: '1' }, { id: 'int', enabled: 'bool' })).toEqual({
            id: 1,
            enabled: true,
        });
        expect(strategy.normalizeColumnValue('boolean', 0)).toBe(false);
        expect(strategy.normalizeColumnValue('text', 1)).toBe(1);
    });

    it('returns copies when there are no sqlite boolean columns', () => {
        const strategy = new SqliteRowNormalizerStrategy();
        const rows = [{ id: 1, active: 1 }];
        const normalized = strategy.normalizeRootRows(rows, { id: 'int', active: 'int' });

        expect(normalized).toEqual(rows);
        expect(normalized).not.toBe(rows);
        expect(normalized[0]).toBe(rows[0]);
    });
});

describe(PassthroughQueryRowNormalizerStrategy, () => {
    it('preserves row objects for non-sqlite dialects', () => {
        const strategy = new PassthroughQueryRowNormalizerStrategy();
        const rows = [{ id: 1, active: 1 }];

        expect(strategy.normalizeRootRows(rows, { active: 'bool' })).toEqual(rows);
        expect(strategy.normalizeRootRows(rows, { active: 'bool' })[0]).toBe(rows[0]);
        expect(strategy.normalizeTargetRow(rows[0]!, { active: 'bool' })).toBe(rows[0]);
        expect(strategy.normalizeColumnValue('bool', 1)).toBe(1);
    });
});

describe(createQueryRowNormalizerStrategy, () => {
    it('selects a sqlite strategy only for sqlite adapters', () => {
        expect(createQueryRowNormalizerStrategy('sqlite')).toBeInstanceOf(SqliteRowNormalizerStrategy);
        expect(createQueryRowNormalizerStrategy('postgres')).toBeInstanceOf(PassthroughQueryRowNormalizerStrategy);
    });
});
