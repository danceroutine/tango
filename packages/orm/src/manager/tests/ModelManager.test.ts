import { mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MultipleObjectsReturned, NotFoundError } from '@danceroutine/tango-core';
import { aDBClient, aTangoRuntime, setupTestTangoRuntime } from '@danceroutine/tango-testing';
import type { QNode } from '../../query/domain/QNode';
import { InternalRelationKind } from '../../query/domain/internal/InternalRelationKind';
import { InternalQNodeType } from '../../query/domain/internal/InternalQNodeType';
import { Q } from '../../query/index';
import { ModelManager } from '../ModelManager';
import { getTangoRuntime } from '../../runtime/index';
import { atomic } from '../../transaction';
import { sqlInjectionRejectCases, sqlInjectionValueCases } from '../../validation/tests/sqlInjectionCorpus';
import { expectPayloadIsParameterized } from '../../validation/tests/expectPayloadIsParameterized';

type UserRecord = {
    id: number;
    email: string;
    active: boolean;
};

type TokenRecord = {
    id: string;
    email: string;
};

type KindedRecord = {
    id: number;
    kind: string;
    active: boolean;
};

type ModelManagerPrivateStatics = {
    collectPlainFieldsFromQNode<TModelRow extends Record<string, unknown>>(
        modelName: string,
        node: QNode<TModelRow>
    ): Partial<TModelRow>;
};

const UserModel = {
    metadata: {
        name: 'User',
        table: 'users',
        fields: [
            { name: 'id', type: 'int', primaryKey: true },
            { name: 'email', type: 'text' },
            { name: 'active', type: 'bool' },
        ],
    },
    schema: {
        parse(input: unknown): UserRecord {
            return input as UserRecord;
        },
    },
};

const TokenModel = {
    metadata: {
        name: 'Token',
        table: 'tokens',
        fields: [
            { name: 'id', type: 'text', primaryKey: true },
            { name: 'email', type: 'text' },
        ],
    },
    schema: {
        parse(input: unknown): TokenRecord {
            return input as TokenRecord;
        },
    },
};

const KindedModel = {
    metadata: {
        name: 'Kinded',
        table: 'kinded_records',
        fields: [
            { name: 'id', type: 'int', primaryKey: true },
            { name: 'kind', type: 'text' },
            { name: 'active', type: 'bool' },
        ],
    },
    schema: {
        parse(input: unknown): KindedRecord {
            return input as KindedRecord;
        },
    },
};

function findQueryCall(
    calls: ReadonlyArray<readonly [string, readonly unknown[] | undefined]>,
    pattern: RegExp
): readonly [string, readonly unknown[] | undefined] {
    const match = calls.find(([sql]) => pattern.test(String(sql)));
    if (!match) {
        throw new Error(`Expected a query matching ${String(pattern)}.`);
    }
    return match;
}

describe(ModelManager, () => {
    beforeEach(async () => {
        await setupTestTangoRuntime();
    });

    it('derives repository metadata from the model contract and brands the manager', () => {
        const manager = new ModelManager(UserModel, getTangoRuntime());

        expect(ModelManager.isModelManager(manager)).toBe(true);
        expect(ModelManager.isModelManager(null)).toBe(false);
        expect(ModelManager.isModelManager({})).toBe(false);
        expect(manager.meta).toEqual({
            table: 'users',
            pk: 'id',
            columns: { id: 'int', email: 'text', active: 'bool' },
        });
    });

    it('copies planner relation metadata onto the validated table meta when TableMetaFactory supplies relations', async () => {
        const client = await getTangoRuntime().getClient();
        await client.query('CREATE TABLE users (id INTEGER PRIMARY KEY, email TEXT, active INTEGER)');
        await client.query('CREATE TABLE profiles (id INTEGER PRIMARY KEY, userId INTEGER)');

        const relationMeta = {
            edgeId: 'edge',
            sourceModelKey: 'src',
            targetModelKey: 'tgt',
            kind: InternalRelationKind.HAS_ONE,
            cardinality: 'single' as const,
            capabilities: {
                queryable: true,
                hydratable: true,
                joinable: true,
                prefetchable: true,
            },
            table: 'profiles',
            sourceKey: 'id',
            targetKey: 'userId',
            targetPrimaryKey: 'id',
            targetColumns: { id: 'int', userId: 'int' },
            alias: 'profile',
        };

        const factory = await import('../../query/domain/TableMetaFactory');
        const spy = vi.spyOn(factory.TableMetaFactory, 'create').mockReturnValue({
            table: 'users',
            pk: 'id',
            columns: { id: 'int', email: 'text', active: 'bool' },
            relations: { profile: relationMeta },
        });

        try {
            const manager = new ModelManager(UserModel, getTangoRuntime());
            expect(manager.meta.relations?.profile).toMatchObject({
                table: 'profiles',
                kind: InternalRelationKind.HAS_ONE,
            });
        } finally {
            spy.mockRestore();
        }
    });

    it('supports CRUD, query, and getOrThrow operations through the runtime-backed manager', async () => {
        const manager = new ModelManager(UserModel, getTangoRuntime());
        const client = await getTangoRuntime().getClient();
        await client.query('CREATE TABLE users (id INTEGER PRIMARY KEY, email TEXT, active INTEGER)');

        expect(manager.all()).not.toBe(manager.query());

        const created = await manager.create({ id: 1, email: 'user@example.com', active: true });
        expect(created).toEqual({ id: 1, email: 'user@example.com', active: 1 });

        const fetched = await manager.query().fetchOne();
        expect(fetched).toEqual({ id: 1, email: 'user@example.com', active: true });
        expect(await manager.findById(1)).toEqual({ id: 1, email: 'user@example.com', active: true });
        expect(await manager.getOrThrow(1)).toEqual({ id: 1, email: 'user@example.com', active: true });

        const updated = await manager.update(1, { email: 'updated@example.com' });
        expect(updated).toEqual({ id: 1, email: 'updated@example.com', active: 1 });

        expect(await manager.bulkCreate([])).toEqual([]);
        expect(
            await manager.bulkCreate([
                { id: 2, email: 'second@example.com', active: false },
                { id: 3, email: 'third@example.com', active: true },
            ])
        ).toEqual([
            { id: 2, email: 'second@example.com', active: 0 },
            { id: 3, email: 'third@example.com', active: 1 },
        ]);

        await manager.delete(1);
        expect(await manager.query().filter({ id: 1 }).fetchOne()).toBeNull();
        await expect(manager.getOrThrow(1)).rejects.toBeInstanceOf(NotFoundError);
    });

    it('creates or returns an existing row from getOrCreate', async () => {
        const manager = new ModelManager(UserModel, getTangoRuntime());
        const client = await getTangoRuntime().getClient();
        await client.query('CREATE TABLE users (id INTEGER PRIMARY KEY, email TEXT, active INTEGER)');

        const first = await manager.getOrCreate({
            where: { email: 'user@example.com' },
            defaults: { id: 1, active: true },
        });
        expect(first.created).toBe(true);
        expect(first.record).toEqual({ id: 1, email: 'user@example.com', active: 1 });

        const second = await manager.getOrCreate({
            where: { email: 'user@example.com' },
            defaults: { id: 99, active: false },
        });
        expect(second.created).toBe(false);
        expect(second.record).toEqual({ id: 1, email: 'user@example.com', active: true });
    });

    it('raises when getOrCreate or updateOrCreate matches more than one existing row', async () => {
        const manager = new ModelManager(UserModel, getTangoRuntime());
        const client = await getTangoRuntime().getClient();
        await client.query('CREATE TABLE users (id INTEGER PRIMARY KEY, email TEXT, active INTEGER)');
        await client.query(
            "INSERT INTO users (id, email, active) VALUES (1, 'dupe@example.com', 1), (2, 'dupe@example.com', 0)"
        );

        await expect(
            manager.getOrCreate({
                where: { email: 'dupe@example.com' },
                defaults: { id: 3, active: true },
            })
        ).rejects.toBeInstanceOf(MultipleObjectsReturned);

        await expect(
            manager.updateOrCreate({
                where: { email: 'dupe@example.com' },
                update: { active: true },
            })
        ).rejects.toBeInstanceOf(MultipleObjectsReturned);
    });

    it('requires defaults when getOrCreate uses only Q composition', async () => {
        const manager = new ModelManager(UserModel, getTangoRuntime());
        const client = await getTangoRuntime().getClient();
        await client.query('CREATE TABLE users (id INTEGER PRIMARY KEY, email TEXT, active INTEGER)');

        await expect(manager.getOrCreate({ where: { id__gte: 1 } })).rejects.toThrow(
            'Cannot create User from lookup-only filters without defaults.'
        );

        await expect(
            manager.getOrCreate({ where: { email__icontains: 'example' }, defaults: { id: 1 } })
        ).rejects.toThrow('Cannot create User from lookup-only filters without defaults.');

        await expect(manager.getOrCreate({ where: { id: 7 }, defaults: { id: 7 } })).rejects.toThrow(
            'Cannot create User without any values.'
        );

        await expect(manager.getOrCreate({ where: Q.and({ active: true }) })).rejects.toThrow(
            'Cannot create User from Q filters without defaults.'
        );

        await expect(manager.getOrCreate({ where: Q.and({ active: true }), defaults: {} })).rejects.toThrow(
            'Cannot create User from Q filters without defaults.'
        );

        await expect(
            manager.getOrCreate({
                where: Q.and<UserRecord>({ id: 7 }),
                defaults: { id: 7 },
            })
        ).rejects.toThrow('Cannot create User without any values.');

        await expect(
            manager.getOrCreate({
                where: Q.and<UserRecord>({ active: true }),
            })
        ).rejects.toThrow('Cannot create User from Q filters without defaults.');

        await expect(
            manager.getOrCreate({
                where: Q.and<UserRecord>({ active: true }),
                get defaults() {
                    return undefined;
                },
            } as Parameters<ModelManager<UserRecord>['getOrCreate']>[0])
        ).rejects.toThrow('Cannot create User from Q filters without defaults.');

        const createdFromLookupDefaults = await manager.getOrCreate({
            where: { email__icontains: 'created-from-defaults' },
            defaults: { id: 11, email: 'created@example.com', active: true },
        });
        expect(createdFromLookupDefaults.created).toBe(true);
        expect(createdFromLookupDefaults.record).toEqual({ id: 11, email: 'created@example.com', active: 1 });
    });

    it('creates or updates through getOrCreate and updateOrCreate when the filter is a Q tree', async () => {
        const manager = new ModelManager(UserModel, getTangoRuntime());
        const client = await getTangoRuntime().getClient();
        await client.query('CREATE TABLE users (id INTEGER PRIMARY KEY, email TEXT, active INTEGER)');

        const created = await manager.getOrCreate({
            where: Q.and<UserRecord>({ email: 'q@example.com' }),
            defaults: { id: 1, active: true },
        });
        expect(created.created).toBe(true);
        expect(created.record).toEqual({ id: 1, email: 'q@example.com', active: 1 });

        const existing = await manager.getOrCreate({
            where: Q.and<UserRecord>({ email: 'q@example.com' }),
            defaults: { id: 99, active: false },
        });
        expect(existing.created).toBe(false);
        expect(existing.record).toEqual({ id: 1, email: 'q@example.com', active: true });

        await client.query('DELETE FROM users');

        const upInsert = await manager.updateOrCreate({
            where: Q.and<UserRecord>({ email: 'up@example.com' }),
            defaults: { id: 2, active: true },
            update: { active: false },
        });
        expect(upInsert.created).toBe(true);
        expect(upInsert.updated).toBe(false);
        expect(upInsert.record).toEqual({ id: 2, email: 'up@example.com', active: 1 });

        const upUpdate = await manager.updateOrCreate({
            where: Q.and<UserRecord>({ email: 'up@example.com' }),
            defaults: { id: 99, active: true },
            update: { active: false },
        });
        expect(upUpdate.created).toBe(false);
        expect(upUpdate.updated).toBe(true);
        expect(upUpdate.record).toEqual({ id: 2, email: 'up@example.com', active: 0 });

        await expect(
            manager.getOrCreate({
                where: Q.or<UserRecord>({ email: 'a@example.com' }, { email: 'b@example.com' }),
                defaults: { id: 3, active: true },
            })
        ).rejects.toThrow('Cannot derive a create payload from User OR filters with multiple predicates');

        await expect(
            manager.getOrCreate({
                where: Q.or<UserRecord>({ email: 'same@example.com' }, { email: 'same@example.com' }),
                defaults: { id: 4, active: true },
            })
        ).rejects.toThrow('Cannot derive a create payload from User OR filters with multiple predicates');

        await client.query('DELETE FROM users');

        const orLookupOnly = await manager.getOrCreate({
            where: Q.or<UserRecord>({ email__icontains: 'a' }, { email__icontains: 'b' }),
            defaults: { id: 8, email: 'orlookup@example.com', active: true },
        });
        expect(orLookupOnly.created).toBe(true);
        expect(orLookupOnly.record).toEqual({ id: 8, email: 'orlookup@example.com', active: 1 });

        await client.query('DELETE FROM users');

        const orMixed = await manager.getOrCreate({
            where: Q.or<UserRecord>({ email: 'single-or@example.com' }, { email__icontains: 'unused' }),
            defaults: { id: 9, active: true },
        });
        expect(orMixed.created).toBe(true);
        expect(orMixed.record).toEqual({ id: 9, email: 'single-or@example.com', active: 1 });

        await client.query('DELETE FROM users');

        await manager.getOrCreate({
            where: Q.not<UserRecord>({ active: false }),
            defaults: { id: 5, email: 'not@example.com', active: true },
        });

        await client.query('DELETE FROM users');

        await expect(
            manager.getOrCreate({
                where: Q.and<UserRecord>({ email: 'x@example.com' }, { email: 'y@example.com' }),
                defaults: { id: 10, active: true },
            })
        ).rejects.toThrow("Conflicting values for 'email'");

        await client.query('DELETE FROM users');

        const emptyAnd = await manager.getOrCreate({
            where: Q.and<UserRecord>(),
            defaults: { id: 6, email: 'empty-and@example.com', active: true },
        });
        expect(emptyAnd.created).toBe(true);
        expect(emptyAnd.record).toEqual({ id: 6, email: 'empty-and@example.com', active: 1 });

        await client.query('DELETE FROM users');

        const emptyOr = await manager.getOrCreate({
            where: Q.or<UserRecord>(),
            defaults: { id: 7, email: 'empty-or@example.com', active: true },
        });
        expect(emptyOr.created).toBe(true);
        expect(emptyOr.record).toEqual({ id: 7, email: 'empty-or@example.com', active: 1 });
    });

    it('treats a plain filter with a kind field as a filter instead of a Q node', async () => {
        const manager = new ModelManager(KindedModel, getTangoRuntime());
        const client = await getTangoRuntime().getClient();
        await client.query('CREATE TABLE kinded_records (id INTEGER PRIMARY KEY, kind TEXT, active INTEGER)');

        const created = await manager.getOrCreate({
            where: { kind: 'news' },
            defaults: { id: 1, active: true },
        });
        expect(created.created).toBe(true);
        expect(created.record).toEqual({ id: 1, kind: 'news', active: 1 });

        const qCreated = await manager.getOrCreate({
            where: Q.and<KindedRecord>({ kind: 'feature' }),
            defaults: { id: 2, active: false },
        });
        expect(qCreated.created).toBe(true);
        expect(qCreated.record).toEqual({ id: 2, kind: 'feature', active: 0 });

        const updated = await manager.updateOrCreate({
            where: { kind: 'feature' },
            update: { active: true },
        });
        expect(updated.created).toBe(false);
        expect(updated.updated).toBe(true);
        expect(updated.record).toEqual({ id: 2, kind: 'feature', active: 1 });
    });

    it('tolerates AND and OR nodes without a nodes array when deriving plain fields', () => {
        const privateStatics = ModelManager as unknown as ModelManagerPrivateStatics;

        expect(
            privateStatics.collectPlainFieldsFromQNode('User', {
                kind: InternalQNodeType.AND,
                nodes: undefined,
            } as unknown as QNode<UserRecord>)
        ).toEqual({});

        expect(
            privateStatics.collectPlainFieldsFromQNode('User', {
                kind: InternalQNodeType.OR,
                nodes: undefined,
            } as unknown as QNode<UserRecord>)
        ).toEqual({});
    });

    it('creates, updates, or returns from updateOrCreate', async () => {
        const manager = new ModelManager(UserModel, getTangoRuntime());
        const client = await getTangoRuntime().getClient();
        await client.query('CREATE TABLE users (id INTEGER PRIMARY KEY, email TEXT, active INTEGER)');

        const created = await manager.updateOrCreate({
            where: { email: 'user@example.com' },
            defaults: { id: 1, active: true },
            update: { active: false },
        });
        expect(created.created).toBe(true);
        expect(created.updated).toBe(false);
        expect(created.record).toEqual({ id: 1, email: 'user@example.com', active: 1 });

        const updated = await manager.updateOrCreate({
            where: { email: 'user@example.com' },
            defaults: { id: 99, active: true },
            update: { active: false },
        });
        expect(updated.created).toBe(false);
        expect(updated.updated).toBe(true);
        expect(updated.record).toEqual({ id: 1, email: 'user@example.com', active: 0 });

        const noop = await manager.updateOrCreate({
            where: { email: 'user@example.com' },
            update: {},
        });
        expect(noop.created).toBe(false);
        expect(noop.updated).toBe(false);
        expect(noop.record).toEqual({ id: 1, email: 'user@example.com', active: false });

        const noopBare = await manager.updateOrCreate({
            where: { email: 'user@example.com' },
        });
        expect(noopBare.created).toBe(false);
        expect(noopBare.updated).toBe(false);
        expect(noopBare.record).toEqual({ id: 1, email: 'user@example.com', active: false });

        await client.query('DELETE FROM users');

        await client.query("INSERT INTO users (id, email, active) VALUES (2, 'defaults-only@example.com', 1)");

        const patchedByDefaults = await manager.updateOrCreate({
            where: { email: 'defaults-only@example.com' },
            defaults: { active: false },
        });
        expect(patchedByDefaults.created).toBe(false);
        expect(patchedByDefaults.updated).toBe(true);
        expect(patchedByDefaults.record).toEqual({ id: 2, email: 'defaults-only@example.com', active: 0 });

        await client.query('DELETE FROM users');

        const insertedWithDefaultsOnly = await manager.updateOrCreate({
            where: { email: 'insert-no-update-key@example.com' },
            defaults: { id: 3, active: false },
        });
        expect(insertedWithDefaultsOnly.created).toBe(true);
        expect(insertedWithDefaultsOnly.updated).toBe(false);
        expect(insertedWithDefaultsOnly.record).toEqual({
            id: 3,
            email: 'insert-no-update-key@example.com',
            active: 0,
        });
    });

    it('uses postgres placeholders for create, update, delete, and bulkCreate when the runtime dialect is postgres', async () => {
        const client = aDBClient({
            query: async <T = unknown>(_sql: string, _params?: readonly unknown[]) => ({
                rows: [{ id: 1, email: 'user@example.com', active: true }] as T[],
            }),
        });
        const runtime = aTangoRuntime({ adapter: 'postgres' });
        vi.spyOn(runtime, 'query').mockImplementation((sql, params) => client.query(sql, params));
        const manager = new ModelManager(UserModel, runtime);

        await manager.create({ email: 'user@example.com', active: true });
        await manager.update(1, { email: 'updated@example.com', active: false });
        await manager.delete(1);
        await manager.bulkCreate([
            { email: 'first@example.com', active: true },
            { email: 'second@example.com', active: false },
        ]);

        const calls = vi.mocked(client.query).mock.calls.map(([sql, params]) => [String(sql), params] as const);
        expect(findQueryCall(calls, /^INSERT INTO users \(email, active\) VALUES \(\$1, \$2\) RETURNING \*$/)).toEqual([
            'INSERT INTO users (email, active) VALUES ($1, $2) RETURNING *',
            ['user@example.com', true],
        ]);
        expect(
            findQueryCall(calls, /^UPDATE users SET email = \$1, active = \$2 WHERE id = \$3 RETURNING \*$/)
        ).toEqual([
            'UPDATE users SET email = $1, active = $2 WHERE id = $3 RETURNING *',
            ['updated@example.com', false, 1],
        ]);
        expect(findQueryCall(calls, /^DELETE FROM users WHERE id = \$1$/)).toEqual([
            'DELETE FROM users WHERE id = $1',
            [1],
        ]);
        expect(
            findQueryCall(calls, /^INSERT INTO users \(email, active\) VALUES \(\$1, \$2\), \(\$3, \$4\) RETURNING \*$/)
        ).toEqual([
            'INSERT INTO users (email, active) VALUES ($1, $2), ($3, $4) RETURNING *',
            ['first@example.com', true, 'second@example.com', false],
        ]);
    });

    it('throws when the model does not expose a primary key field', () => {
        const manager = new ModelManager(
            {
                metadata: {
                    name: 'Broken',
                    table: 'broken',
                    fields: [{ name: 'email', type: 'text' }],
                },
                schema: UserModel.schema,
            },
            getTangoRuntime()
        );

        expect(() => manager.meta).toThrow(/primary key/i);
    });

    it('rejects unsafe SQL identifiers derived from model metadata', () => {
        const manager = new ModelManager(
            {
                metadata: {
                    name: 'User',
                    table: 'users; DROP TABLE users;',
                    fields: [{ name: 'id', type: 'int', primaryKey: true }],
                },
                schema: UserModel.schema,
            },
            getTangoRuntime()
        );

        expect(() => manager.meta).toThrow(/invalid sql table name/i);
    });

    it.each(sqlInjectionRejectCases.filter((testCase) => testCase.applicablePosition === 'identifier'))(
        '$id rejects identifier corpus payloads in model metadata',
        (testCase) => {
            const manager = new ModelManager(
                {
                    metadata: {
                        name: 'User',
                        table: testCase.payload,
                        fields: [{ name: 'id', type: 'int', primaryKey: true }],
                    },
                    schema: UserModel.schema,
                },
                getTangoRuntime()
            );

            expect(() => manager.meta).toThrow();
        }
    );

    it('rejects empty create and update payloads', async () => {
        const manager = new ModelManager(UserModel, getTangoRuntime());
        const client = await getTangoRuntime().getClient();
        await client.query('CREATE TABLE users (id INTEGER PRIMARY KEY, email TEXT, active INTEGER)');
        await client.query("INSERT INTO users (id, email, active) VALUES (1, 'user@example.com', 1)");

        await expect(manager.create({})).rejects.toThrow('Cannot create User without any values.');
        await expect(manager.update(1, {})).rejects.toThrow('Cannot update User without any values.');
        await expect(manager.bulkCreate([{}])).rejects.toThrow('Cannot create User without any values.');
    });

    it('uses the model name in not-found errors', async () => {
        const manager = new ModelManager(UserModel, getTangoRuntime());
        const client = await getTangoRuntime().getClient();
        await client.query('CREATE TABLE users (id INTEGER PRIMARY KEY, email TEXT, active INTEGER)');

        await expect(manager.getOrThrow(123)).rejects.toThrow('User with id=123 not found');
    });

    it('runs model-owned lifecycle hooks for create, update, delete, and bulkCreate', async () => {
        const events: string[] = [];
        const HookedUserModel = {
            ...UserModel,
            hooks: {
                beforeCreate: vi.fn(async ({ data }) => {
                    events.push(`beforeCreate:${String(data.email)}`);
                    return { ...data, email: String(data.email).toLowerCase() };
                }),
                afterCreate: vi.fn(async ({ record }) => {
                    events.push(`afterCreate:${record.email}`);
                }),
                beforeUpdate: vi.fn(async ({ current, patch }) => {
                    events.push(`beforeUpdate:${current.email}`);
                    return { ...patch, email: String(patch.email).toLowerCase() };
                }),
                afterUpdate: vi.fn(async ({ previous, record }) => {
                    events.push(`afterUpdate:${previous.email}->${record.email}`);
                }),
                beforeDelete: vi.fn(async ({ current }) => {
                    events.push(`beforeDelete:${current.email}`);
                }),
                afterDelete: vi.fn(async ({ previous }) => {
                    events.push(`afterDelete:${previous.email}`);
                }),
                beforeBulkCreate: vi.fn(async ({ rows }) => {
                    events.push(`beforeBulkCreate:${rows.length}`);
                    return rows.map((row: Partial<UserRecord>) => ({ ...row, active: true }));
                }),
                afterBulkCreate: vi.fn(async ({ records }) => {
                    events.push(`afterBulkCreate:${records.length}`);
                }),
            },
        };
        const manager = new ModelManager(HookedUserModel, getTangoRuntime());
        const client = await getTangoRuntime().getClient();
        await client.query('CREATE TABLE users (id INTEGER PRIMARY KEY, email TEXT, active INTEGER)');

        const created = await manager.create({ id: 1, email: 'User@Example.com', active: false });
        expect(created.email).toBe('user@example.com');

        const updated = await manager.update(1, { email: 'Updated@Example.com' });
        expect(updated.email).toBe('updated@example.com');

        const bulkCreated = await manager.bulkCreate([
            { id: 2, email: 'Second@Example.com' },
            { id: 3, email: 'Third@Example.com' },
        ]);
        expect(bulkCreated).toEqual([
            { id: 2, email: 'second@example.com', active: 1 },
            { id: 3, email: 'third@example.com', active: 1 },
        ]);

        await manager.delete(1);

        expect(events).toEqual([
            'beforeCreate:User@Example.com',
            'afterCreate:user@example.com',
            'beforeUpdate:user@example.com',
            'afterUpdate:user@example.com->updated@example.com',
            'beforeCreate:Second@Example.com',
            'beforeCreate:Third@Example.com',
            'beforeBulkCreate:2',
            'afterCreate:second@example.com',
            'afterCreate:third@example.com',
            'afterBulkCreate:2',
            'beforeDelete:updated@example.com',
            'afterDelete:updated@example.com',
        ]);
    });

    it('rejects a bulk create when model hooks strip every row value', async () => {
        const manager = new ModelManager(
            {
                ...UserModel,
                hooks: {
                    beforeBulkCreate: vi.fn(async () => []),
                },
            },
            getTangoRuntime()
        );

        await expect(manager.bulkCreate([{ id: 1, email: 'user@example.com', active: true }])).rejects.toThrow(
            'Cannot create User without any values.'
        );
    });

    it('passes the active transaction handle into hooks only while running inside atomic(...)', async () => {
        const tempDir = await mkdtemp(join(tmpdir(), 'tango-orm-hooks-'));

        try {
            await setupTestTangoRuntime({ sqliteFilename: join(tempDir, 'hooks.sqlite') });

            const seenTransactions: unknown[] = [];
            const manager = new ModelManager(
                {
                    ...UserModel,
                    hooks: {
                        afterCreate: vi.fn(({ transaction }) => {
                            seenTransactions.push(transaction);
                        }),
                    },
                },
                getTangoRuntime()
            );
            const client = await getTangoRuntime().getClient();
            await client.query('CREATE TABLE users (id INTEGER PRIMARY KEY, email TEXT, active INTEGER)');

            await manager.create({ id: 1, email: 'outside@example.com', active: true });

            await atomic(async () => {
                await manager.create({ id: 2, email: 'inside@example.com', active: true });
            });

            expect(seenTransactions[0]).toBeUndefined();
            expect(seenTransactions[1]).toBeDefined();
            expect(typeof (seenTransactions[1] as { onCommit?: unknown }).onCommit).toBe('function');
        } finally {
            await rm(tempDir, { recursive: true, force: true });
        }
    });

    it.each(sqlInjectionValueCases)('$id keeps $category payloads bound during create', async (testCase) => {
        const client = aDBClient({
            query: async <T = unknown>(_sql: string, _params?: readonly unknown[]) => ({
                rows: [{ id: 'token', email: testCase.payload }] as T[],
            }),
        });
        const runtime = aTangoRuntime({ adapter: 'postgres' });
        vi.spyOn(runtime, 'query').mockImplementation((sql, params) => client.query(sql, params));
        const manager = new ModelManager(TokenModel, runtime);

        await manager.create({ id: 'token', email: testCase.payload });

        const [sql, params] = vi.mocked(client.query).mock.calls[0]!;
        expectPayloadIsParameterized(String(sql), params ?? [], testCase.payload);
    });

    it.each(sqlInjectionValueCases)('$id keeps $category payloads bound during update', async (testCase) => {
        const client = aDBClient({
            query: async <T = unknown>(_sql: string, _params?: readonly unknown[]) => ({
                rows: [{ id: 'token', email: testCase.payload }] as T[],
            }),
        });
        const runtime = aTangoRuntime({ adapter: 'postgres' });
        vi.spyOn(runtime, 'query').mockImplementation((sql, params) => client.query(sql, params));
        const manager = new ModelManager(TokenModel, runtime);

        await manager.update('token', { email: testCase.payload });

        const [sql, params] = vi.mocked(client.query).mock.calls.at(-1)!;
        expectPayloadIsParameterized(String(sql), params ?? [], testCase.payload);
    });

    it.each(sqlInjectionValueCases)('$id keeps $category payloads bound during delete', async (testCase) => {
        const client = aDBClient({
            query: async <T = unknown>(_sql: string, _params?: readonly unknown[]) => ({
                rows: [{ id: testCase.payload, email: 'bound@example.com' }] as T[],
            }),
        });
        const runtime = aTangoRuntime({ adapter: 'postgres' });
        vi.spyOn(runtime, 'query').mockImplementation((sql, params) => client.query(sql, params));
        const manager = new ModelManager(TokenModel, runtime);

        await manager.delete(testCase.payload);

        const [sql, params] = vi.mocked(client.query).mock.calls.at(-1)!;
        expectPayloadIsParameterized(String(sql), params ?? [], testCase.payload);
    });

    it.each(sqlInjectionValueCases)('$id keeps $category payloads bound during bulk create', async (testCase) => {
        const client = aDBClient({
            query: async <T = unknown>(_sql: string, _params?: readonly unknown[]) => ({
                rows: [{ id: 'token', email: testCase.payload }] as T[],
            }),
        });
        const runtime = aTangoRuntime({ adapter: 'postgres' });
        vi.spyOn(runtime, 'query').mockImplementation((sql, params) => client.query(sql, params));
        const manager = new ModelManager(TokenModel, runtime);

        await manager.bulkCreate([{ id: 'token', email: testCase.payload }]);

        const [sql, params] = vi.mocked(client.query).mock.calls[0]!;
        expectPayloadIsParameterized(String(sql), params ?? [], testCase.payload);
    });
});
