import type { DBClient } from '../connection/clients/DBClient';

/**
 * Unit of Work pattern implementation for managing database transactions.
 * Ensures that a set of operations either all succeed or all fail together.
 *
 * @example
 * ```typescript
 * const uow = await UnitOfWork.start(dbClient);
 * try {
 *   await userRepo.create({ email: 'test@example.com' });
 *   await postRepo.create({ title: 'Hello' });
 *   await uow.commit();
 * } catch (error) {
 *   await uow.rollback();
 *   throw error;
 * }
 * ```
 */
export class UnitOfWork {
    static readonly BRAND = 'tango.orm.unit_of_work' as const;
    readonly __tangoBrand: typeof UnitOfWork.BRAND = UnitOfWork.BRAND;
    protected client: DBClient;
    protected isActive = false;

    constructor(client: DBClient) {
        this.client = client;
    }

    /**
     * Narrow an unknown value to `UnitOfWork`.
     */
    static isUnitOfWork(value: unknown): value is UnitOfWork {
        return (
            typeof value === 'object' &&
            value !== null &&
            (value as { __tangoBrand?: unknown }).__tangoBrand === UnitOfWork.BRAND
        );
    }

    /**
     * Convenience factory that constructs and begins a unit of work.
     */
    static async start(client: DBClient): Promise<UnitOfWork> {
        const uow = new UnitOfWork(client);
        await uow.begin();
        return uow;
    }

    /**
     * Begin a transaction if one is not already active.
     */
    async begin(): Promise<void> {
        if (!this.isActive) {
            await this.client.begin();
            this.isActive = true;
        }
    }

    /**
     * Commit the active transaction.
     */
    async commit(): Promise<void> {
        if (this.isActive) {
            await this.client.commit();
            this.isActive = false;
        }
    }

    /**
     * Return the underlying database client.
     */
    getClient(): DBClient {
        return this.client;
    }

    /**
     * Roll back the active transaction.
     */
    async rollback(): Promise<void> {
        if (this.isActive) {
            await this.client.rollback();
            this.isActive = false;
        }
    }
}
