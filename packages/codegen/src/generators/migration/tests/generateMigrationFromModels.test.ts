import { describe, expect, it, vi } from 'vitest';
import { generateMigrationFromModels } from '../generateMigrationFromModels';

describe(generateMigrationFromModels, () => {
    it('generates forward and reverse migration operations', () => {
        const nowSpy = vi.spyOn(Date, 'now').mockReturnValue(1700000000000);

        const migrationText = generateMigrationFromModels([
            {
                name: 'User',
                fields: {
                    id: { type: 'uuid', dbType: 'uuid', primaryKey: true },
                    email: { type: 'text', unique: true },
                },
            },
            {
                name: 'Post',
                fields: [
                    { name: 'id', type: 'serial', primaryKey: true, notNull: true },
                    { name: 'subtitle', type: 'text', notNull: false },
                ],
            },
        ]);

        expect(migrationText).toContain('class Migration_auto_generated_1700000000000 extends Migration');
        expect(migrationText).toContain("id = 'auto_generated_1700000000000';");
        expect(migrationText).toContain(
            "import { Migration, op, type Builder } from '@danceroutine/tango-migrations';"
        );
        expect(migrationText).toContain('up(m: Builder)');
        expect(migrationText).toContain('down(m: Builder)');
        expect(migrationText).toContain("op.table('users').create");
        expect(migrationText).toContain('b.uuid().primaryKey().notNull()');
        expect(migrationText).toContain('b.text().unique().notNull()');
        expect(migrationText).toContain("op.table('posts').create");
        expect(migrationText).toContain('b.text()');
        expect(migrationText).toContain("op.table('posts').drop()");
        expect(migrationText).toContain("op.table('users').drop()");

        nowSpy.mockRestore();
    });
});
