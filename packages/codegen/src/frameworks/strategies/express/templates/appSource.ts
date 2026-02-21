import { TemplateBuilder } from '../../../contracts/template/TemplateBuilder';
import type { FrameworkScaffoldContext } from '../../../contracts/template/ScaffoldTemplate';

export class AppSourceTemplateBuilder extends TemplateBuilder {
    constructor() {
        super({ name: 'src/index.ts' });
    }

    protected override resolveTemplate(_context: FrameworkScaffoldContext): string {
        return `import express from 'express';
import { seedExampleData } from './bootstrap.js';
import { registerTango } from './tango.js';

async function main(): Promise<void> {
    const app = express();
    app.use(express.json());

    if (process.env.AUTO_BOOTSTRAP === 'true') {
        await seedExampleData(Number(process.env.SEED_TODOS_COUNT || '100'));
    }

    app.get('/health', (_req, res) => {
        res.json({ ok: true });
    });

    await registerTango(app);

    const port = Number(process.env.PORT || '3000');
    app.listen(port, () => {
        console.log(\`Tango Express app listening on http://localhost:\${String(port)}\`);
    });
}

// oxlint-disable-next-line unicorn/prefer-top-level-await
main().catch((error: unknown) => {
    console.error('Failed to start app:', error);
    process.exit(1);
});
`;
    }
}
