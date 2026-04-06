import { TemplateBuilder } from '../../../contracts/template/TemplateBuilder';
import type { FrameworkScaffoldContext } from '../../../contracts/template/ScaffoldTemplate';

export class TodoModelTemplateBuilder extends TemplateBuilder {
    constructor() {
        super({ name: 'src/lib/models/TodoModel.ts' });
    }
    static context(context: FrameworkScaffoldContext): TodoModelTemplateBuilder {
        return new TodoModelTemplateBuilder().setContext(context);
    }

    protected override resolveTemplate(_context: FrameworkScaffoldContext): string {
        return `import { z } from 'zod';
import '@danceroutine/tango-orm/runtime';
import { Model, t } from '@danceroutine/tango-schema';

export const TodoReadSchema = z.object({
    id: z.number(),
    title: z.string().min(1),
    completed: z.coerce.boolean(),
    createdAt: z.string(),
    updatedAt: z.string(),
});

export const TodoCreateSchema = z.object({
    title: z.string().min(1),
    completed: z.boolean().optional().default(false),
});

export const TodoUpdateSchema = TodoCreateSchema.partial();

export type Todo = z.output<typeof TodoReadSchema>;

export const TodoModel = Model({
    namespace: 'app',
    name: 'Todo',
    schema: TodoReadSchema.extend({
        id: t.primaryKey(z.number().int()),
        title: z.string().min(1),
        completed: t.field(z.coerce.boolean()).defaultValue('false').build(),
        createdAt: t.field(z.string()).defaultValue({ now: true }).build(),
        updatedAt: t.field(z.string()).defaultValue({ now: true }).build(),
    }),
});
`;
    }
}

export class ModelsBarrelTemplateBuilder extends TemplateBuilder {
    constructor() {
        super({ name: 'src/lib/models/index.ts' });
    }

    protected override resolveTemplate(_context: FrameworkScaffoldContext): string {
        return `export { TodoReadSchema, TodoCreateSchema, TodoUpdateSchema, TodoModel, type Todo } from './TodoModel';
`;
    }
}
