import { describe, expect, it } from 'vitest';
import { normalizeFields } from '../fieldType';

describe(normalizeFields, () => {
    it('passes through object field shapes as key-value tuples', () => {
        expect(
            normalizeFields({
                id: { type: 'uuid', primaryKey: true },
                email: { type: 'text', unique: true },
            })
        ).toEqual([
            ['id', { type: 'uuid', primaryKey: true }],
            ['email', { type: 'text', unique: true }],
        ]);
    });

    it('converts array field shapes to key-value tuples with normalised flags', () => {
        expect(
            normalizeFields([
                { name: 'id', type: 'uuid', primaryKey: true, notNull: true },
                { name: 'meta', type: 'jsonb', notNull: false, default: null },
            ])
        ).toEqual([
            ['id', { type: 'uuid', primaryKey: true, unique: undefined, nullable: false, default: undefined }],
            ['meta', { type: 'jsonb', primaryKey: undefined, unique: undefined, nullable: true, default: null }],
        ]);
    });
});
