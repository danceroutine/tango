import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { Model, ModelRegistry, t } from '../index';

describe('t decorator helpers', () => {
    it('supports decorator-style invocation without schema arg', () => {
        const schema = z.object({
            id: t.primaryKey<z.ZodNumber>()(z.number().int()),
            email: t.unique<z.ZodString>()(z.string()),
            maybe: t.null<z.ZodString>()(z.string()),
        });

        const model = Model({
            namespace: 'decorators',
            name: 'DecoratorStyle',
            table: 'decorator_style',
            schema,
        });

        expect(model.metadata.fields.find((f) => f.name === 'id')?.primaryKey).toBe(true);
        expect(model.metadata.fields.find((f) => f.name === 'email')?.unique).toBe(true);
        expect(model.metadata.fields.find((f) => f.name === 'maybe')?.notNull).toBe(false);
    });

    it('supports oneToOne and manyToMany helpers', () => {
        ModelRegistry.clear();

        const profile = Model({
            namespace: 'decorators',
            name: 'Profile',
            table: 'profiles',
            schema: z.object({ id: t.primaryKey(z.number().int()) }),
        });

        const user = Model({
            namespace: 'decorators',
            name: 'User',
            table: 'users',
            schema: z.object({
                id: t.primaryKey(z.number().int()),
                profileId: t.oneToOne(profile, { field: z.number().int() }),
                tags: t.manyToMany('decorators/Profile'),
            }),
        });

        expect(user.metadata.fields.find((f) => f.name === 'profileId')?.unique).toBe(true);
        expect(user.metadata.fields.find((f) => f.name === 'profileId')?.references?.table).toBe('profiles');
        expect(user.schema.safeParse({ id: 1, profileId: 2, tags: [1, 2] }).success).toBe(true);

        const explicitMany = t.manyToMany('decorators/Profile', { field: z.array(z.number().int()) });
        expect(explicitMany.safeParse([1, 2, 3]).success).toBe(true);
    });

    it('accepts metadata-only decorators for docs/validation hints', () => {
        const schema = z.object({
            score: t.errorMessages(
                t.helpText(
                    t.validators(
                        t.choices(t.dbIndex(t.dbDefault(t.default(z.number(), '0'), '0')), [0, 1, 2]),
                        (value) => value
                    ),
                    'Score between 0 and 2'
                ),
                { invalid_type: 'Score must be numeric' }
            ),
        });

        const parsed = schema.parse({ score: 1 });
        expect(parsed.score).toBe(1);
    });

    it('chains scalar field metadata through the field builder', () => {
        const schema = z.object({
            score: t
                .field(z.number())
                .defaultValue('0')
                .dbDefault('0')
                .dbColumn('score_value')
                .dbIndex()
                .choices([0, 1, 2])
                .validators((value) => value)
                .helpText('Score between 0 and 2')
                .errorMessages({ invalid_type: 'Score must be numeric' })
                .build(),
        });

        const model = Model({
            namespace: 'decorators',
            name: 'ScalarConfig',
            table: 'scalar_configs',
            schema,
        });

        expect(model.metadata.fields.find((field) => field.name === 'score_value')).toMatchObject({
            name: 'score_value',
            default: '0',
        });
    });

    it('supports shorthand foreignKey and oneToOne forms', () => {
        ModelRegistry.clear();

        Model({
            namespace: 'decorators',
            name: 'Target',
            table: 'targets',
            schema: z.object({ id: t.primaryKey(z.number().int()) }),
        });

        const schema = z.object({
            fk: t.foreignKey('decorators/Target', { onDelete: 'CASCADE' }),
            one: t.oneToOne('decorators/Target', { onUpdate: 'CASCADE' }),
        });

        const model = Model({
            namespace: 'decorators',
            name: 'Holder',
            table: 'holders',
            schema,
        });

        expect(model.metadata.fields.find((f) => f.name === 'fk')?.references?.onDelete).toBe('CASCADE');
        expect(model.metadata.fields.find((f) => f.name === 'one')?.references?.onUpdate).toBe('CASCADE');
    });
});
