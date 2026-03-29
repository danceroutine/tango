import { TemplateBuilder } from '../../../contracts/template/TemplateBuilder';
import type { FrameworkScaffoldContext } from '../../../contracts/template/ScaffoldTemplate';

export class TodoSerializerTemplateBuilder extends TemplateBuilder {
    constructor() {
        super({ name: 'src/serializers/TodoSerializer.ts' });
    }

    protected override resolveTemplate(_context: FrameworkScaffoldContext): string {
        return `import { ModelSerializer } from '@danceroutine/tango-resources';
import { TodoCreateSchema, TodoModel, TodoReadSchema, TodoUpdateSchema, type Todo } from '../models/index.js';

export class TodoSerializer extends ModelSerializer<
    Todo,
    typeof TodoCreateSchema,
    typeof TodoUpdateSchema,
    typeof TodoReadSchema
> {
    static readonly model = TodoModel;
    static readonly createSchema = TodoCreateSchema;
    static readonly updateSchema = TodoUpdateSchema;
    static readonly outputSchema = TodoReadSchema;
}
`;
    }
}

export class SerializersBarrelTemplateBuilder extends TemplateBuilder {
    constructor() {
        super({ name: 'src/serializers/index.ts' });
    }

    protected override resolveTemplate(_context: FrameworkScaffoldContext): string {
        return `export { TodoSerializer } from './TodoSerializer.js';
`;
    }
}
