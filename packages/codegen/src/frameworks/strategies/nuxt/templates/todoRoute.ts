import { TemplateBuilder } from '../../../contracts/template/TemplateBuilder';
import type { FrameworkScaffoldContext } from '../../../contracts/template/ScaffoldTemplate';

export class TodoRouteTemplateBuilder extends TemplateBuilder {
    constructor() {
        super({ name: 'server/tango/todos.ts' });
    }

    protected override resolveTemplate(_context: FrameworkScaffoldContext): string {
        return `import { NuxtAdapter } from '@danceroutine/tango-adapters-nuxt/adapter';
import { TodoViewSet } from '~~/viewsets/TodoViewSet';

const adapter = new NuxtAdapter();
export default adapter.adaptViewSet(new TodoViewSet());
`;
    }
}
