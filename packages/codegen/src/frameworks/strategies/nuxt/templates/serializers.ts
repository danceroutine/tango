import { TemplateBuilder } from '../../../contracts/template/TemplateBuilder';
import type { FrameworkScaffoldContext } from '../../../contracts/template/ScaffoldTemplate';

export class TodoSerializerTemplateBuilder extends TemplateBuilder {
    constructor() {
        super({ name: 'serializers/TodoSerializer.ts' });
    }

    protected override resolveTemplate(_context: FrameworkScaffoldContext): string {
        return `import { ModelSerializer } from '@danceroutine/tango-resources';
import { TodoCreateSchema, TodoModel, TodoReadSchema, TodoUpdateSchema, type Todo } from '~~/lib/models';

export class TodoSerializer extends ModelSerializer<
    Todo,
    typeof TodoCreateSchema,
    typeof TodoUpdateSchema,
    typeof TodoReadSchema
> {
    static override readonly model = TodoModel;
    static override readonly createSchema = TodoCreateSchema;
    static override readonly updateSchema = TodoUpdateSchema;
    static override readonly outputSchema = TodoReadSchema;
}
`;
    }
}

export class SerializersBarrelTemplateBuilder extends TemplateBuilder {
    constructor() {
        super({ name: 'serializers/index.ts' });
    }

    protected override resolveTemplate(_context: FrameworkScaffoldContext): string {
        return `export { TodoSerializer } from './TodoSerializer';
`;
    }
}
