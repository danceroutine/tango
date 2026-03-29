import { describe, expect, it } from 'vitest';
import { createDefaultCommandModules } from '../commands/createDefaultCommandModules';

describe(createDefaultCommandModules, () => {
    it('returns the built-in CLI modules', () => {
        const modules = createDefaultCommandModules();

        expect(modules.map((module) => module.id)).toEqual(['migrations', 'codegen']);
    });
});
