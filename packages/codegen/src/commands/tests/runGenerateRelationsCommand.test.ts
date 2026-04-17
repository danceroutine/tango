import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { withGlobalTestApi } from '@danceroutine/tango-testing';
import { Model, t } from '@danceroutine/tango-schema';
import { runGenerateRelationsCommand } from '../runGenerateRelationsCommand';

describe(runGenerateRelationsCommand, () => {
    it('loads a models module and writes relation registry artifacts', async () => {
        const root = await mkdtemp(join(process.cwd(), '.tmp-tango-codegen-relations-cmd-'));
        const cwdBefore = process.cwd();

        try {
            process.chdir(root);
            await mkdir(join(root, 'src'), { recursive: true });
            await writeFile(
                join(root, 'src/models.ts'),
                `
                import { z } from 'zod';
                const { Model, t } = globalThis.__tangoCodegenRelationsTestApi;

                export const UserModel = Model({
                    namespace: 'blog',
                    name: 'User',
                    table: 'users',
                    schema: z.object({
                        id: t.primaryKey(z.number().int()),
                    }),
                });

                export const PostModel = Model({
                    namespace: 'blog',
                    name: 'Post',
                    table: 'posts',
                    schema: z.object({
                        id: t.primaryKey(z.number().int()),
                        authorId: t.foreignKey('blog/User', {
                            field: z.number().int(),
                            relatedName: 'posts',
                        }),
                    }),
                });
                `,
                'utf8'
            );

            await withGlobalTestApi('__tangoCodegenRelationsTestApi', { Model, t }, async () => {
                await runGenerateRelationsCommand({
                    models: './src/models.ts',
                    outDir: '.tango',
                });
            });

            const declaration = await readFile(join(root, '.tango/relations.generated.d.ts'), 'utf8');
            const metadata = await readFile(join(root, '.tango/relations.generated.json'), 'utf8');
            expect(declaration).toContain('"blog/User"');
            expect(metadata).toContain('"fingerprint"');
        } finally {
            process.chdir(cwdBefore);
            await rm(root, { recursive: true, force: true });
        }
    });
});
