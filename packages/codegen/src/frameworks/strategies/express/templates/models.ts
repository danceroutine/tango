import { TemplateBuilder } from '../../../contracts/template/TemplateBuilder';
import type { FrameworkScaffoldContext } from '../../../contracts/template/ScaffoldTemplate';

export class TodoModelTemplateBuilder extends TemplateBuilder {
    constructor() {
        super({ name: 'src/models/TodoModel.ts' });
    }

    protected override resolveTemplate(_context: FrameworkScaffoldContext): string {
        return `import { z } from 'zod';
import { registerModelObjects } from '@danceroutine/tango-orm/runtime';
import { Model, t } from '@danceroutine/tango-schema';

registerModelObjects();

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
        super({ name: 'src/models/index.ts' });
    }

    protected override resolveTemplate(_context: FrameworkScaffoldContext): string {
        return `export { TodoReadSchema, TodoCreateSchema, TodoUpdateSchema, TodoModel, type Todo } from './TodoModel.js';
`;
    }
}
