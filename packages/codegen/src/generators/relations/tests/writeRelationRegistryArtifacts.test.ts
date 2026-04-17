import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { describe, expect, it } from 'vitest';
import { Model, ModelRegistry, t } from '@danceroutine/tango-schema';
import { z } from 'zod';
import { writeRelationRegistryArtifacts } from '../writeRelationRegistryArtifacts';

describe(writeRelationRegistryArtifacts, () => {
    it('writes the generated declaration and metadata files', async () => {
        const root = await mkdtemp(join(tmpdir(), 'tango-codegen-relations-'));
        const registry = new ModelRegistry();
        try {
            Model({
                registry,
                namespace: 'blog',
                name: 'User',
                table: 'users',
                schema: z.object({
                    id: t.primaryKey(z.number().int()),
                }),
            });
            Model({
                registry,
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

            const written = await writeRelationRegistryArtifacts({
                registry,
                modelTypeAccessors: {
                    'blog/User': 'typeof import("../src/models.ts")["UserModel"]',
                    'blog/Post': 'typeof import("../src/models.ts")["PostModel"]',
                },
                outputDir: root,
            });

            const declaration = await readFile(written.typesFilepath, 'utf8');
            const metadata = JSON.parse(await readFile(written.metadataFilepath, 'utf8')) as { fingerprint: string };

            expect(declaration).toContain('"blog/User"');
            expect(metadata.fingerprint).toBe(written.fingerprint);
        } finally {
            await rm(root, { recursive: true, force: true });
        }
    });
});
