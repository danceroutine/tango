import { describe, expect, it } from 'vitest';
import * as adapterCore from '../index';

describe('adapters/core exports', () => {
    it('loads the package entrypoint', () => {
        expect(adapterCore).toBeTypeOf('object');
        expect(adapterCore.adapter).toBeDefined();
        expect(adapterCore.FRAMEWORK_ADAPTER_BRAND).toBe('tango.adapter.framework');
    });

    it('accepts only values that satisfy the framework adapter contract', () => {
        const candidate = {
            __tangoBrand: adapterCore.FRAMEWORK_ADAPTER_BRAND,
            adapt: () => 'handler',
        };

        expect(adapterCore.isFrameworkAdapter(candidate)).toBe(true);
        expect(adapterCore.isFrameworkAdapter({ adapt: () => 'handler' })).toBe(false);
        expect(adapterCore.isFrameworkAdapter(null)).toBe(false);
    });
});
