import { describe, expect, it } from 'vitest';
import { TodoModelTemplateBuilder } from '../models';
import type { FrameworkScaffoldContext } from '../../../../contracts/template/ScaffoldTemplate';

const context: FrameworkScaffoldContext = {
    projectName: 'todo-app',
    targetDir: '/tmp/todo-app',
    framework: 'next',
    packageManager: 'pnpm',
    dialect: 'sqlite',
    includeSeed: true,
};

describe(TodoModelTemplateBuilder, () => {
    describe(TodoModelTemplateBuilder.context, () => {
        it('returns a bound template builder that renders the Todo model template', () => {
            const template = TodoModelTemplateBuilder.context(context);

            expect(template.getPath()).toBe('src/lib/models/TodoModel.ts');
            expect(template.build()).toContain("import '@danceroutine/tango-orm/runtime';");
        });
    });
});
