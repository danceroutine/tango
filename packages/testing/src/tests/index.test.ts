import { describe, it, expect, beforeEach } from 'vitest';
import { ModelDataFactory, aDBClient, assertions } from '../index';
import { z } from 'zod';

describe('@danceroutine/tango-testing', () => {
    describe(aDBClient, () => {
        it('returns a database client double', () => {
            const client = aDBClient();

            expect(client).toBeDefined();
            expect(client.query).toBeInstanceOf(Function);
            expect(client.begin).toBeInstanceOf(Function);
            expect(client.commit).toBeInstanceOf(Function);
            expect(client.rollback).toBeInstanceOf(Function);
            expect(client.close).toBeInstanceOf(Function);
            expect(client.createSavepoint).toBeInstanceOf(Function);
            expect(client.releaseSavepoint).toBeInstanceOf(Function);
            expect(client.rollbackToSavepoint).toBeInstanceOf(Function);
        });

        it('query returns empty rows by default', async () => {
            const client = aDBClient();
            const result = await client.query('SELECT * FROM users');

            expect(result.rows).toEqual([]);
        });

        it('transaction methods are no-ops', async () => {
            const client = aDBClient();

            await expect(client.begin()).resolves.toBeUndefined();
            await expect(client.commit()).resolves.toBeUndefined();
            await expect(client.rollback()).resolves.toBeUndefined();
            await expect(client.close()).resolves.toBeUndefined();
            await expect(client.createSavepoint('sp')).resolves.toBeUndefined();
            await expect(client.releaseSavepoint('sp')).resolves.toBeUndefined();
            await expect(client.rollbackToSavepoint('sp')).resolves.toBeUndefined();
        });
    });

    describe(ModelDataFactory, () => {
        const mockModel = {
            create: (data: Record<string, unknown>) => ({ ...data }),
            parse: (data: unknown) =>
                z
                    .object({
                        id: z.number(),
                        email: z.string().email(),
                        name: z.string(),
                    })
                    .parse(data),
        };

        let factory: ModelDataFactory<typeof mockModel>;

        beforeEach(() => {
            factory = new ModelDataFactory(mockModel, {
                email: 'default@example.com',
                name: 'Default User',
            });
        });

        it('fills in default values for new instances', () => {
            const user = factory.build({ id: 1 });

            expect(user.email).toBe('default@example.com');
            expect(user.name).toBe('Default User');
            expect(user.id).toBe(1);
        });

        it('overrides defaults with provided values', () => {
            const user = factory.build({
                id: 2,
                email: 'custom@example.com',
                name: 'Custom User',
            });

            expect(user.email).toBe('custom@example.com');
            expect(user.name).toBe('Custom User');
            expect(user.id).toBe(2);
        });

        it('builds multiple instances', () => {
            const users = factory.buildList(3, { id: 1 });

            expect(users).toHaveLength(3);
            users.forEach((user) => {
                expect(user.email).toBe('default@example.com');
            });
        });

        it('increments sequence for each build', () => {
            expect(factory.getSequence()).toBe(0);

            factory.build({ id: 1 });
            expect(factory.getSequence()).toBe(1);

            factory.build({ id: 2 });
            expect(factory.getSequence()).toBe(2);

            factory.buildList(3, { id: 3 });
            expect(factory.getSequence()).toBe(5);
        });

        it('resets sequence', () => {
            factory.build({ id: 1 });
            factory.build({ id: 2 });
            expect(factory.getSequence()).toBe(2);

            factory.resetSequence();
            expect(factory.getSequence()).toBe(0);
        });
    });

    describe('assertions', () => {
        const mockModel = {
            create: (data: Record<string, unknown>) => ({ ...data }),
            parse: (data: unknown) =>
                z
                    .object({
                        id: z.number(),
                        email: z.string().email(),
                        name: z.string(),
                    })
                    .parse(data),
        };

        describe(assertions.matchesSchema, () => {
            it('passes for valid data', () => {
                const data = {
                    id: 1,
                    email: 'user@example.com',
                    name: 'Test User',
                };
                expect(() => assertions.matchesSchema(mockModel, data)).not.toThrow();
            });

            it('throws for invalid data', () => {
                const data = {
                    id: 1,
                    email: 'invalid-email',
                    name: 'Test User',
                };

                expect(() => assertions.matchesSchema(mockModel, data)).toThrow();
            });

            it('throws for missing required fields', () => {
                const data = {
                    id: 1,
                    name: 'Test User',
                };

                expect(() => assertions.matchesSchema(mockModel, data)).toThrow();
            });
        });
    });
});
