import {
    type ScaffoldTemplate,
    type ScaffoldTemplateCategory,
    type FrameworkScaffoldContext,
    type ScaffoldMode,
    SCAFFOLD_TEMPLATE_CATEGORY,
} from '../ScaffoldTemplate';
import type { TemplateBuilder } from '../TemplateBuilder';

export class ScaffoldTemplateDescriptor implements ScaffoldTemplate {
    constructor(
        readonly template: TemplateBuilder,
        readonly category: ScaffoldTemplateCategory
    ) {}
    public get path(): string {
        return this.template.getPath();
    }

    render(ctx: FrameworkScaffoldContext): string {
        return this.template.setContext(ctx).build();
    }

    shouldEmit(mode: ScaffoldMode): boolean {
        if (mode === 'new') {
            return (
                this.category === SCAFFOLD_TEMPLATE_CATEGORY.FRAMEWORK ||
                this.category === SCAFFOLD_TEMPLATE_CATEGORY.TANGO
            );
        }
        return (
            this.category === SCAFFOLD_TEMPLATE_CATEGORY.TANGO || this.category === SCAFFOLD_TEMPLATE_CATEGORY.INIT_ONLY
        );
    }
}
