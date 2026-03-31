import { TemplateBuilder } from '../../../contracts/template/TemplateBuilder';
import type { FrameworkScaffoldContext } from '../../../contracts/template/ScaffoldTemplate';

export class ViewSetTemplateBuilder extends TemplateBuilder {
    constructor() {
        super({ name: 'viewsets/TodoViewSet.ts' });
    }

    protected override resolveTemplate(_context: FrameworkScaffoldContext): string {
        return `import { FilterSet, ModelViewSet } from '@danceroutine/tango-resources';
import { type Todo } from '~~/lib/models';
import { TodoSerializer } from '~~/serializers';

export class TodoViewSet extends ModelViewSet<Todo, typeof TodoSerializer> {
    constructor() {
        super({
            serializer: TodoSerializer,
            filters: FilterSet.define<Todo>({
                fields: {
                    completed: true,
                },
                aliases: {
                    q: { fields: ['title'], lookup: 'icontains' },
                },
            }),
            orderingFields: ['id', 'createdAt', 'updatedAt', 'title'],
            searchFields: ['title'],
        });
    }
}
`;
    }
}
