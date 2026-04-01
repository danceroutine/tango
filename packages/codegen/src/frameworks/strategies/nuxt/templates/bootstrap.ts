import { TemplateBuilder } from '../../../contracts/template/TemplateBuilder';
import type { FrameworkScaffoldContext } from '../../../contracts/template/ScaffoldTemplate';

export class BootstrapTemplateBuilder extends TemplateBuilder {
    constructor() {
        super({ name: 'scripts/bootstrap.ts' });
    }

    protected override resolveTemplate(_context: FrameworkScaffoldContext): string {
        return `import { TodoModel, type Todo } from '../lib/models';

async function seedExampleData(count = 100): Promise<void> {
    const existing = await TodoModel.objects.query().count();
    if (existing >= count) {
        console.log(\`[bootstrap] Skipped; already have \${existing} todos.\`);
        return;
    }

    const rows: Array<Partial<Todo>> = [];
    for (let index = existing; index < count; index += 1) {
        const now = new Date(Date.now() - index * 60_000).toISOString();
        rows.push({
            title: \`Seeded todo #\${index + 1}\`,
            completed: index % 3 === 0,
            createdAt: now,
            updatedAt: now,
        });
    }

    await TodoModel.objects.bulkCreate(rows);
    console.log(\`[bootstrap] Seeded \${rows.length} todos.\`);
}

const count = Number(process.env.SEED_TODOS_COUNT || '100');
// oxlint-disable-next-line unicorn/prefer-top-level-await
seedExampleData(Number.isFinite(count) ? count : 100).catch((error: unknown) => {
    console.error('[bootstrap] Failed:', error);
    process.exit(1);
});
`;
    }
}
