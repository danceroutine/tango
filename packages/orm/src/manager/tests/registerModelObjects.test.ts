import { beforeEach, describe, expect, it } from 'vitest';
import { z } from 'zod';
import { setupTestTangoRuntime } from '@danceroutine/tango-testing';
import { Model, t } from '@danceroutine/tango-schema';
import { ModelManager } from '../index';
import { registerModelObjects } from '../registerModelObjects';

describe(registerModelObjects, () => {
    beforeEach(async () => {
        registerModelObjects();
        await setupTestTangoRuntime();
    });

    it('exposes a runtime-backed objects manager on plain Tango models', () => {
        const UserModel = Model({
            namespace: 'test',
            name: 'User',
            schema: z.object({
                id: t.primaryKey(z.number().int()),
                email: z.string().email(),
            }),
        });

        expect(ModelManager.isModelManager(UserModel.objects)).toBe(true);
        expect(UserModel.objects.meta).toEqual({
            table: 'users',
            pk: 'id',
            columns: {
                id: 'int',
                email: 'text',
            },
        });
    });

    it('is safe to call more than once', () => {
        expect(() => registerModelObjects()).not.toThrow();
    });
});
