import { TemplateBuilder } from '../../../contracts/template/TemplateBuilder';
import type { FrameworkScaffoldContext } from '../../../contracts/template/ScaffoldTemplate';

export class PageTemplateBuilder extends TemplateBuilder {
    constructor() {
        super({ name: 'src/app/page.tsx' });
    }

    protected override resolveTemplate(_context: FrameworkScaffoldContext): string {
        return `import { TodoModel, TodoReadSchema } from '@/lib/models';

export default async function HomePage() {
    const todos = await TodoModel.objects.query().orderBy('-createdAt').limit(10).fetch(TodoReadSchema);

    return (
        <main style={{ fontFamily: 'system-ui', margin: '2rem auto', maxWidth: '60ch' }}>
            <h1>Tango + Next.js</h1>
            <p>Showing {todos.length} todos through Tango's runtime-backed model manager.</p>
            <ul>
                {todos.map((todo) => (
                    <li key={todo.id}>{todo.title}</li>
                ))}
            </ul>
        </main>
    );
}
`;
    }
}
