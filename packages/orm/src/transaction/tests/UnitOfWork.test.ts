import { describe, it, expect, vi, beforeEach } from 'vitest';
import { UnitOfWork } from '../UnitOfWork';
import type { DBClient } from '../../connection/clients/DBClient';
import { aDBClient } from '@danceroutine/tango-testing';

describe(UnitOfWork, () => {
    let mockClient: DBClient;

    beforeEach(() => {
        mockClient = aDBClient({
            query: vi.fn(async () => ({ rows: [] })),
            begin: vi.fn(async () => {}),
            commit: vi.fn(async () => {}),
            rollback: vi.fn(async () => {}),
            close: vi.fn(async () => {}),
        });
    });

    it('begins transaction on start', async () => {
        const uow = await UnitOfWork.start(mockClient);

        expect(mockClient.begin).toHaveBeenCalledOnce();
        expect(uow.getClient()).toBe(mockClient);
    });

    it('commits transaction', async () => {
        const uow = await UnitOfWork.start(mockClient);
        await uow.commit();

        expect(mockClient.commit).toHaveBeenCalledOnce();
    });

    it('rolls back transaction', async () => {
        const uow = await UnitOfWork.start(mockClient);
        await uow.rollback();

        expect(mockClient.rollback).toHaveBeenCalledOnce();
    });

    it('does not begin twice', async () => {
        const uow = new UnitOfWork(mockClient);
        await uow.begin();
        await uow.begin();

        expect(mockClient.begin).toHaveBeenCalledOnce();
    });

    it('does not commit if not active', async () => {
        const uow = new UnitOfWork(mockClient);
        await uow.commit();

        expect(mockClient.commit).not.toHaveBeenCalled();
    });

    it('does not rollback if not active', async () => {
        const uow = new UnitOfWork(mockClient);
        await uow.rollback();

        expect(mockClient.rollback).not.toHaveBeenCalled();
    });

    it('identifies matching instances', () => {
        const uow = new UnitOfWork(mockClient);
        expect(UnitOfWork.isUnitOfWork(uow)).toBe(true);
        expect(UnitOfWork.isUnitOfWork({})).toBe(false);
    });
});
