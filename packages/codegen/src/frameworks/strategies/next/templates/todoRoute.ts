import { TemplateBuilder } from '../../../contracts/template/TemplateBuilder';
import type { FrameworkScaffoldContext } from '../../../contracts/template/ScaffoldTemplate';

export class TodoRouteTemplateBuilder extends TemplateBuilder {
    constructor() {
        super({ name: 'src/app/api/todos/[[...tango]]/route.ts' });
    }

    protected override resolveTemplate(_context: FrameworkScaffoldContext): string {
        return `import { NextAdapter } from '@danceroutine/tango-adapters-next/adapter';
import { TodoViewSet } from '@/viewsets/TodoViewSet';

const adapter = new NextAdapter();
export const { GET, POST, PUT, PATCH, DELETE } = adapter.adaptViewSet(new TodoViewSet());
`;
    }
}
