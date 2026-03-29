import { describe, expect, it } from 'vitest';
import { sqlInjectionCorpus, sqlInjectionRejectCases, sqlInjectionValueCases } from './sqlInjectionCorpus';

describe('sqlInjectionCorpus', () => {
    it('contains exactly 120 curated cases with source attribution', () => {
        expect(sqlInjectionCorpus).toHaveLength(120);
        expect(sqlInjectionCorpus.every((testCase) => testCase.source.length > 0)).toBe(true);
        expect(sqlInjectionCorpus.every((testCase) => testCase.sourceUrl.startsWith('http'))).toBe(true);
        expect(sqlInjectionCorpus.every((testCase) => testCase.payload.length > 0)).toBe(true);
    });

    it('splits the corpus into reject and parameterize cases', () => {
        expect(sqlInjectionRejectCases.length + sqlInjectionValueCases.length).toBe(120);
        expect(sqlInjectionRejectCases.every((testCase) => testCase.expectedBehavior === 'reject')).toBe(true);
        expect(sqlInjectionValueCases.every((testCase) => testCase.expectedBehavior === 'parameterize')).toBe(true);
    });
});
