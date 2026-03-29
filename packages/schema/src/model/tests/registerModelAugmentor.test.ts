import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { z } from 'zod';
import { Model, ModelRegistry, registerModelAugmentor } from '../index';

describe(registerModelAugmentor, () => {
    beforeEach(() => {
        ModelRegistry.clear();
    });

    afterEach(() => {
        ModelRegistry.clear();
    });

    it('applies augmentors to existing and future models', () => {
        const existing = Model({
            namespace: 'test',
            name: 'ExistingUser',
            schema: z.object({
                id: z.number().int(),
            }),
        });

        const unregister = registerModelAugmentor((model) => {
            Object.defineProperty(model, '__augmented', {
                configurable: true,
                enumerable: true,
                value: true,
            });
        });

        const future = Model({
            namespace: 'test',
            name: 'FutureUser',
            schema: z.object({
                id: z.number().int(),
            }),
        });

        expect((existing as { __augmented?: boolean }).__augmented).toBe(true);
        expect((future as { __augmented?: boolean }).__augmented).toBe(true);

        unregister();
    });
});
