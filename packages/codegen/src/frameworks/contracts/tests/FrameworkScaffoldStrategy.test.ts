import { describe, expect, it } from 'vitest';
import { FrameworkScaffoldStrategy, SUPPORTED_FRAMEWORK } from '../FrameworkScaffoldStrategy';
import { TemplateBuilder } from '../template/TemplateBuilder';

class StubFrameworkScaffoldStrategy extends FrameworkScaffoldStrategy {
    readonly id = SUPPORTED_FRAMEWORK.EXPRESS;
    readonly name = 'Stub';
    readonly description = 'Stub strategy for tests';

    override getTemplates() {
        return [
            this.addFrameworkTemplate(TemplateBuilder.createStaticTemplate('framework.txt', 'framework')),
            this.addTangoTemplate(TemplateBuilder.createStaticTemplate('tango.txt', 'tango')),
            this.addInitOnlyTemplate(TemplateBuilder.createStaticTemplate('init.txt', 'init')),
        ];
    }
}

describe(FrameworkScaffoldStrategy, () => {
    it('adds init-only templates that emit only during init mode', () => {
        const strategy = new StubFrameworkScaffoldStrategy();
        const initOnly = strategy.getTemplates().find((template) => template.path === 'init.txt');

        expect(initOnly).toBeDefined();
        expect(initOnly?.shouldEmit('init')).toBe(true);
        expect(initOnly?.shouldEmit('new')).toBe(false);
    });
});
