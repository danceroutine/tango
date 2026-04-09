import { describe, expect, it } from 'vitest';
import { aTangoRuntime } from '../aTangoRuntime';

describe(aTangoRuntime, () => {
    it('builds a standalone runtime from the generated config', () => {
        const runtime = aTangoRuntime({ adapter: 'postgres' });

        expect(runtime.getDialect()).toBe('postgres');
        expect(runtime.getConfig().current.db.adapter).toBe('postgres');
    });
});
