import { afterEach, describe, expect, it, vi } from 'vitest';

describe('aQuerySet', () => {
    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('warns once and delegates to aModelQuerySet', async () => {
        const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
        vi.resetModules();

        const { aQuerySet } = await import('../aQuerySet');

        const first = aQuerySet<{ id: number }>();
        const second = aQuerySet<{ id: number }>();

        expect(first.filter({})).toBe(first);
        expect(second.filter({})).toBe(second);
        expect(warnSpy).toHaveBeenCalledTimes(1);
        expect(warnSpy).toHaveBeenCalledWith(
            '[tango.testing.mocks]',
            '`aQuerySet(...)` is deprecated. Use `aModelQuerySet(...)` instead.'
        );
    });
});
