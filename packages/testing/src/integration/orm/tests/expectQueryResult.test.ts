import { describe, expect, it } from 'vitest';
import { expectQueryResult } from '../index';

describe('expectQueryResult', () => {
    it('passes when results are structurally equal', async () => {
        await expectQueryResult(Promise.resolve([1, 2]), [1, 2]);
    });

    it('throws when results do not match expected value', async () => {
        await expect(expectQueryResult(Promise.resolve([1]), [2])).rejects.toThrow(
            'Expected query result [2], got [1]'
        );
    });
});
